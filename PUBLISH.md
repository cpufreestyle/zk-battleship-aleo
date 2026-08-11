# 隐海战舰 Shadow Fleet — 发布清单（工作室 Phase 3 收尾）

> 由 Web 游戏工作室主理人汇总。本作已从「能玩的核心循环」推到「可上架」。
> 所有验证结论均来自 web-release 的 headless Chrome（CDP）实测，非推测。

---

## 一、质量闸结论（已实测通过）

| 验证项 | 结果 | 证据 |
|---|---|---|
| 构建 | ✅ | `vite build` 通过；首屏 ~35KB / gzip 14KB，21MB wasm + 724KB worker **懒加载** |
| 音频手势解锁 | ✅ | 加载阶段 `acCount=0`；点「开始游戏」后 `acCount=0→1`、`state="running"`，调用栈仅 `startGame→sfx.init()` |
| 特效层扛住全量重渲染 | ✅ | 注入 140px 位移 + 连续 12~13 次 `#app.innerHTML` 重写，`#fx-layer` 从未被冲掉、目标格对齐 0px（rAF 重定位生效） |
| 真 ZK 在线跑通 | ✅ | `crossOriginIsolated=true`、引擎 163ms 就绪、真实 Aleo 地址、0 报错 |
| 三场景资源 | ✅ | 隔离 / 无头 nocoi / 子路径 均 Console 0 error、资源全 200 |

**本会话额外收尾（主理人亲自做）**：
- reduced-motion 半降级 bug 修复（媒体查询扩到 `.fx-node *` 等后代），并清掉重复块
- `#app` 去掉 `position:relative`（避免给 `#fx-layer` 的 fixed 定位埋雷，仅留 `isolation:isolate`）
- 修两处降级模式假话：状态栏不再写"calculating ZK proof"；结算页按 `zkEnabled` 二分表述
- 中文化我方补完（锦屏漏做游戏内英文 UI）

---

## 二、本地构建（重要）

沙箱环境删除 21MB wasm 会被 safe-delete 拦截，导致 `npm run build` 在清空 dist 时失败。
**在本地正常环境**用：

```bash
cd web-app
npm install
npm run clean && npm run build      # 推荐；clean 绕开删除拦截
# 若仍报删除失败，改用覆盖式（不清空目录）：
npx vite build --emptyOutDir false
```

> 注意：`dist/` 内可能残留旧哈希文件（覆盖式构建不会清），不影响上线，但发布前建议 `clean` 一次更干净。

---

## 三、三平台一键发布

### 1. itch.io（推荐首发，真 ZK 支持最好）
```bash
npm run package:itch               # 产出 release/shadowfleet-web.zip
```
网页端：新建项目 → Kind 选 **HTML** → 上传 zip 勾 *played in browser* →
**Embed Options → Frame Options → 勾 `SharedArrayBuffer support`**（不勾则 Firefox/Safari 只能玩降级版）
→ Viewport 1280×800（响应式自适应）。

### 2. GitHub Pages
```bash
npm run build
# 把 dist/ 内容推到 gh-pages 分支根目录
```
- `base:"./"` 已保证子路径不 404；`public/.nojekyll` 已关 Jekyll
- 无自定义响应头 → 由 `coi-serviceworker.js` 首访自动重载一次兜底跨源隔离

### 3. CloudStudio
用本地 Static Site 部署 `web-app/dist`（同样靠 SW 兜底）。

### 其他（已配好响应头）
Netlify / Cloudflare Pages（`public/_headers`）、Vercel（`vercel.json`）：
Build `npm run build`，Publish `dist`。

**各平台真 ZK 可用性**：itch 勾 SAB / Netlify/Vercel 配头 → 全浏览器真 ZK；
GitHub Pages / CloudStudio → SW 兜底，失败则降级，**降级态仍可玩**。

---

## 四、发布后缺口清单（非阻断，建议后续）

1. **`web-app/worker.js` 手写死代码**（零引用，本会话用户拒删）→ 后续手动删；
   dist 中 724KB `worker-*.js` 是 `@provablehq/wasm` 内部线程池，**不能删**。
2. **`leo/` 多人链上逻辑未接前端**：ZK 目前单机自验，多人对战才是 ZK 真正价值。
3. **真 ZK 依赖线上跨源隔离**：部分平台降级态体验弱于真 ZK。
4. **键盘可达性**：网格非键盘可达（web-ui 已标注遗留）。
5. **375px 真机视觉复核**：沙箱无法目测，本地 DevTools 过一眼（重点看我方板头护盾胶囊与静音键间距）。

---

## 五、本地快速验证
```bash
npm run serve:dist              # 隔离环境预览
npm run serve:dist:nocoi        # 复现 GitHub Pages 无响应头
npm run serve:dist:subpath      # 复现子路径
```
QA 开关：`?zk=off` 强制降级、`?nocoi=1` 关 SW 兜底、`?zk=on` 强制加载。
