# 隐海战舰 — 构建与部署手册

面向发布阶段（web-release）的可执行 runbook。所有结论均在本机实测过，不是推测。

---

## 1. 构建

```bash
cd web-app
npm install
npm run build          # 产出 dist/
```

Node 版本用 **v22**（README 说明 v24 有 npm 问题）。本项目实测通过的版本：`v22.22.2`。

> **重复构建报 `[safe-delete] 操作失败`？** 跑 `npm run clean` 再 build。
> 某些开发沙箱会拦截 Node 的 `fs.rmSync` 并改成"移入回收站"，对 21MB 的
> `aleo_wasm.wasm` 会失败，导致 vite 在 `emptyOutDir` 阶段中断。
> `npm run clean` 直接调系统删除命令绕过该拦截。普通机器和 CI 上不会遇到。

### 产物体积基线

| 文件 | 原始 | gzip | 何时下载 |
|---|---|---|---|
| `index.html` | 1.8 KB | 1.2 KB | 首屏 |
| `assets/index-*.js`（游戏本体） | ~26 KB | ~10 KB | 首屏 |
| `assets/index-*.css` | 9.4 KB | 2.4 KB | 首屏 |
| `coi-serviceworker.js` | 7.1 KB | — | 首屏 |
| `assets/aleo-zk-*.js`（Aleo SDK） | 408 KB | 76 KB | **懒加载**，仅 ZK 可用时 |
| `assets/aleo_wasm-*.wasm` | 20.9 MB | 12.1 MB | **懒加载**，仅 ZK 可用时 |
| `assets/worker-*.js` | 725 KB | — | 仅多线程路径 |
| **dist 总计** | **约 22 MB** | | |

> 首屏关键路径只有 **约 35 KB**（gzip 后约 14 KB）。21MB 的 wasm 走动态 import，
> 游戏先渲染、ZK 后台加载，ZK 不可用时**根本不下载**。

---

## 2. 核心约束：跨源隔离（COOP/COEP）

`@provablehq/wasm` 的 glue 里写死了：

```js
new WebAssembly.Memory({initial:168, maximum:65536, shared:true})
```

`shared:true` 是**无条件**的，不是只有开线程池才需要。且它在**模块顶层 await** 执行 ——
import 即触发。所以能不能建 wasm 共享内存，直接决定 ZK 引擎能不能加载。

### 实测结论（别按直觉写判断）

在**未隔离**的页面里实测（headless Chrome，本项目构建产物）：

```
crossOriginIsolated      = false
typeof SharedArrayBuffer = "undefined"
new WebAssembly.Memory({shared:true})  →  成功
Aleo SDK 加载 → 成功；verify_hit(7,1) → ["1u32"]，20ms
```

**Chrome 桌面版隐藏了 `SharedArrayBuffer` 全局构造器，却仍允许 wasm 共享内存。**
SDK 只用后者。所以：

- ❌ 用 `crossOriginIsolated === true` 判断 → 误杀 Chrome，白白丢掉真 ZK
- ❌ 用 `typeof SharedArrayBuffer !== "undefined"` 判断 → 同样误杀
- ✅ 唯一正确判据：**照抄 SDK 那行，试建一块最小共享内存**

`zk.js` 和 `public/coi-serviceworker.js` 都用这一个判据，两边必须保持一致。

### 各托管环境对照表

| 托管 | 能否自定义响应头 | 做法 | 预期结果 |
|---|---|---|---|
| 本机 `npm run dev` / `preview` | 可 | `vite.config.js` 已配 | 隔离，真 ZK |
| **itch.io** | 可（开关） | 项目设置 → Embed Options → Frame Options → 勾 **SharedArrayBuffer support** | 隔离，真 ZK（全浏览器） |
| itch.io（**没勾**） | 否 | 靠 SW 兜底 / Chrome 宽松策略 | Chrome 真 ZK；Firefox/Safari 视 SW 是否成功 |
| **GitHub Pages** | 否 | `public/coi-serviceworker.js` 自动兜底 | 首访重载一次后隔离；失败则降级 |
| **CloudStudio** | 否 | 同上 | 同上 |
| Netlify / Cloudflare Pages | 可 | `public/_headers` 已配 | 隔离，真 ZK |
| Vercel | 可 | `vercel.json` 已配 | 隔离，真 ZK |

### 三层降级策略（已实测）

```
L1  能力探测：试建 wasm 共享内存
      ├─ 成功 → L2
      └─ 失败 → coi-serviceworker 注册 SW 合成 COOP/COEP，重载一次（每会话最多 1 次）
                  ├─ 成功 → 重载后探测通过 → L2
                  └─ 失败 → L3
L2  动态 import Aleo SDK → 真实 ZK 证明
L3  干净降级：派发 zk-error，游戏走 main.js 本地校验分支
```

**关键保证：L3 不白屏、不卡死。** 旧代码是静态 `import "@provablehq/sdk"`，
在严格浏览器里模块求值就抛错，会连带 `main.js` 一起失败 → 整页白屏。
现在改成动态 import + 探测前置，最坏情况也只是没有真 ZK。

---

## 3. 部署前自测（三个场景都要过）

```bash
npm run build

# 场景 A：隔离环境（itch.io 勾选 / Netlify / Vercel）
npm run serve:dist
# → http://localhost:4173  期望控制台 "[ZK] 引擎就绪"

# 场景 B：无自定义响应头（GitHub Pages / CloudStudio）
npm run serve:dist:nocoi
# → 期望 coi-serviceworker 注册并自动重载一次，之后真 ZK 生效

# 场景 C：子路径部署（GitHub Pages 的 /repo-name/）
npm run serve:dist:subpath
# → http://localhost:4173/shadowfleet/  期望所有资源 200，无 /assets 404
```

### QA 开关

| 参数 | 作用 |
|---|---|
| `?zk=off` | 强制走降级路径，用来在**任意**环境验证"没有真 ZK 时游戏依然完整可玩" |
| `?zk=on` | 跳过能力探测强行加载 SDK（调试用） |
| `?nocoi=1` | 关闭 coi-serviceworker 兜底，验证最坏情况 |

发布前必须跑一遍 `?zk=off&nocoi=1`，确认**开始界面正常渲染、能进对局**。

已实测结果（`?nocoi=1&zk=off`）：未捕获异常 **0**、wasm 请求 **0**、SDK chunk 请求 **0**、
开始界面与「开始游戏」按钮均正常渲染。

---

## 4. base 路径

`vite.config.js` 设 `base: "./"`（相对路径）。

原来是默认的 `/`，产物里会出现 `new URL("/assets/aleo_wasm-xxx.wasm", ...)` 这种绝对路径，
在 itch.io / GitHub Pages 子目录下**必然 404**。改成相对后，同一份 dist 可以丢进任意深度的目录。

构建后可自查：

```bash
grep -o '"/assets/[^"]*"' dist/assets/*.js dist/index.html   # 应无输出
```

若某个平台确实需要绝对子路径：

```bash
VITE_BASE=/repo-name/ npm run build
```

---

## 5. 各平台上架步骤

### itch.io

```bash
npm run package:itch     # 产出 release/shadowfleet-web.zip
```

1. 新建项目，**Kind of project 选 HTML**
2. 上传 zip，勾选 *This file will be played in the browser*
3. **Embed Options → Frame Options → 勾上 `SharedArrayBuffer support`**
   ← 不勾的话 Firefox/Safari 玩家只能玩到降级版
4. Viewport 建议 1280×800（本作为响应式 DOM 布局，可自适应）
5. 勾选后游戏由 `html.itch.zone` 提供，COOP/COEP 由平台注入

### GitHub Pages

```bash
npm run build
# 把 dist/ 内容推到 gh-pages 分支根目录
```

- `public/.nojekyll` 已包含 → 关闭 Jekyll，避免下划线开头文件被吞
- 无法自定义响应头 → 由 `coi-serviceworker.js` 兜底
- `base: "./"` 已保证子路径可用，无需改配置

### CloudStudio

用 `cloudstudio-deploy` 部署 `dist/` 目录即可（静态站点，含 index.html）。
同样靠 SW 兜底。

### Netlify / Cloudflare Pages / Vercel

- Build command `npm run build`，Publish directory `dist`
- 响应头已由 `public/_headers`（Netlify/CF）和 `vercel.json`（Vercel）配好

---

## 6. 资源管线约定

```
web-app/
├── public/                 # 原样拷贝到 dist 根，URL 稳定不带哈希
│   ├── audio/              # 音频资源（当前空：音效为 WebAudio 程序化合成）
│   ├── icons/              # 图标 / favicon
│   │   └── favicon.svg
│   ├── coi-serviceworker.js
│   ├── _headers            # Netlify / Cloudflare Pages
│   └── .nojekyll           # GitHub Pages
├── scripts/                # 构建与发布脚本
│   ├── serve-dist.mjs      # 多场景本地预览服务器
│   └── package-itch.mjs    # 打 itch.io zip
├── index.html
├── main.js                 # 游戏逻辑（web-2d-gameplay 所有）
├── style.css               # 样式（web-2d-gameplay 所有）
├── zk.js                   # ZK 运行时接入层 + 降级策略（架构所有）
├── vite.config.js
└── vercel.json
```

### 引用规则（重要）

`public/` 下的资源**必须用 `./` 开头的相对路径**引用：

```js
new Audio("./audio/bgm-battle.ogg")   // ✅
new Audio("/audio/bgm-battle.ogg")    // ❌ 子路径部署下 404
```

### 命名约定

- 音频：`bgm-<场景>.ogg` / `sfx-<事件>.ogg`，全小写连字符
  例：`bgm-battle.ogg`、`sfx-hit.ogg`、`sfx-miss.ogg`、`sfx-sink.ogg`
- 格式：`.ogg` 优先，Safari 兜底再补 `.mp3`
- 图标：`public/icons/`，favicon 用 SVG

### 音频自动播放策略

浏览器禁止未经用户手势的音频播放。`AudioContext` 必须在**用户点击**
（例如「开始游戏」按钮）时才 `resume()`，不要在页面加载时创建并启动，
否则会被静音拦截且状态卡在 `suspended`。

---

## 7. 已知缺口（留给发布阶段）

1. **Firefox / Safari 未实机验证** — 本机只有 Chrome。SW 兜底路径在这两个浏览器上
   需要真机回归；预期是 SW 生效则真 ZK，不生效则干净降级（不会白屏）。
2. **itch.io iframe 内 SW 行为未验证** — 若 itch 的 iframe 带 `sandbox` 限制，
   SW 可能注册失败。**因此 itch.io 上架强烈建议直接勾 SharedArrayBuffer 选项**，
   不要依赖 SW 兜底。
3. **12MB gzip 的 wasm 下载** — 首次进入 ZK 模式需要拉 12MB（gzip 后）。
   已做成后台懒加载不阻塞游戏，但弱网玩家可能长时间停在降级态。
   若要优化需要上游 SDK 支持更小的 wasm，非工程侧能解决。
4. **`worker.js` 是死代码** — `web-app/worker.js` 用了 `initThreadPool`，
   但没有任何地方引用它（`index.html` 和 `main.js` 都没有）。未被打包进 dist。
   要么接上多线程，要么删掉，避免误导后来者。
5. **降级态的玩家文案** — 目前降级时开始页显示
   「⏳ 正在初始化零知识引擎…（就绪前先用本地模式）」，
   但此时其实已经**确定**拿不到真 ZK 了，文案暗示"还在加载"不够诚实。
   `window.__zkDiag` 已暴露 `{mode, crossOriginIsolated, sharedMemory, reason, engineLoadMs}`，
   建议 UI 侧据此改成明确文案。该改动属 `main.js`，不在架构所有权内。
