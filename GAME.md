# GAME.md — 隐海战舰 Shadow Fleet

> Web 游戏开发工作室上下文文件（Phase 0 落盘）。成员启动先读后写。

## 核心玩法动词
**开火**（选格打） + **推理**（从命中/未中推断船位）。对手回击，先打光对方 7 个船格者胜。

## 品类 / 平台
浏览器 **2D 海战棋**。当前为**原生 JS + DOM/CSS 网格**（非 Phaser/Pixi/Three）。免安装、即时游玩。

## 技术栈
- 前端：Vanilla JS + Vite 6
- ZK：`@provablehq/sdk`（Aleo WASM），浏览器本地出证明；链上端到端多人逻辑在 `leo/`，**前端未接**
- 部署目标：静态托管，`npm run build` 已可产出 `web-app/dist/`（约 22MB，首屏仅约 35KB）

### 构建与部署管线（架构 · 墨构）
完整 runbook 见 **`web-app/DEPLOY.md`**，以下为要点。

- **base 路径**：`base: "./"`。原默认 `/` 会让产物出现绝对路径 `/assets/...`，
  在 itch.io / GitHub Pages 子目录下必然 404。改相对后一份 dist 可丢进任意深度目录。
- **build target**：`esnext`。Aleo wasm glue 有模块顶层 await，Vite 6 默认 target 不支持，
  这是此前 `vite build` 一直失败、从未产出过静态包的根因。
- **ZK 降级三层**：能力探测 → 动态 import SDK → 干净降级到本地校验。
  旧代码静态 import SDK，在严格浏览器上会连带 `main.js` 一起崩成**白屏**；现已消除。
- **关键实测结论**：判断 ZK 能否用，**不能**看 `crossOriginIsolated` 或
  `typeof SharedArrayBuffer` —— Chrome 桌面版两者都为 false/undefined，
  但 wasm 共享内存仍可创建，真 ZK 跑得通（实测 20ms 出证明）。
  唯一正确判据是「试建一块 wasm 共享内存」。`zk.js` 与 `coi-serviceworker.js` 共用此判据。
- **QA 开关**：`?zk=off` 强制降级、`?zk=on` 强制加载、`?nocoi=1` 关闭 SW 兜底。
  发布前必须用 `?zk=off&nocoi=1` 验证降级态完整可玩。
- **本地多场景验证**：`npm run serve:dist`（隔离）/ `serve:dist:nocoi`（无响应头）/
  `serve:dist:subpath`（子路径）。`npm run package:itch` 打 itch.io zip。

### 资源管线约定
- `public/audio/` —— 音频落点。当前为空（音效是 WebAudio 程序化合成，无采样文件），
  目录先留出。命名 `bgm-<场景>.ogg` / `sfx-<事件>.ogg`，`.ogg` 优先、Safari 再补 `.mp3`。
- `public/icons/` —— 图标落点，已放 `favicon.svg`。
- **引用必须用 `./` 开头的相对路径**（`new Audio("./audio/x.ogg")`）；
  绝对路径 `/audio/...` 在子路径部署下会 404。
- 音频上下文必须由**用户手势**（点「开始游戏」）触发 `resume()`，
  页面加载即启动会被浏览器自动播放策略拦截并卡在 `suspended`。

## 进度（截至 2026-08-11，工作室流程推进中）

### Phase 1 — 核心循环（玩法 + 架构）
- [x] 核心循环可玩：放船 → 开火 → ZK 验命中 → 对手回击 → 胜负
- [x] 开始游戏页（标题 + 三步玩法 + 开始按钮）
- [x] 中文战斗实况 feed（替代天书 ZK 日志）
- [x] ZK 证明面板折叠为可展开一行，隐私说明汉化
- [x] 对手 AI 改为狩猎/锁定（HUNT 奇偶扫描 + TARGET 命中后正交追击），替换原纯随机  ← 本期主理人直落（agent 派发在当前运行时不可用）
- [x] **音效动效手感三件套落地**（audio.js WebAudio 合成 10 音 + fx.js 独立特效层 + 三拍开火节奏） ← 锋页
- [x] **构建管线打通 + ZK 永不白屏降级三层**（base:./ + esnext + 能力探测动态 import） ← 墨构
- [x] `npm run build` 实测通过，dist 产出（首屏 ~35KB，21MB wasm 懒加载）

### Phase 2 — 内容与质感（UI）
- [x] 进游戏后英文 UI 统一为中文（主理人亲自补完，锦屏漏做）
- [x] 视觉主题升级（深海渐变 / 棋盘水面质感 / 命中未中船位三态区分 / HUD 卡片层次 / 结算弹窗胜败配色）
- [x] 响应式与移动端触摸适配（<768px 单栏、≥44px 热区、`@media (hover:none)` 禁用粘滞 hover、刘海屏 safe-area）
- [x] ZK 卖点一眼可感（我方板头护盾胶囊 + 状态栏 HUD 徽章，安全态绿/降级态琥珀，不伪装）
- [x] reduced-motion 半降级 bug 修复（媒体查询扩到后代 `.fx-node *` 等）← 渡链实测发现，主理人收尾清掉重复块

### Phase 3 — 构建 / 三道闸与发布
- [x] `npm run build` 通过（覆盖式，dist 最新）。首屏 ~35KB / gzip 14KB；21MB wasm + 724KB worker 懒加载
- [x] dev server 质量闸实测（headless Chrome CDP，渡链取证）：三场景 + 真 ZK 全 Console 0 error、资源全 200
  - 音频手势解锁：点「开始游戏」后 acCount 0→1、state running
  - 特效层扛住连续 12~13 次 `#app` 全量重渲染：`#fx-layer` 存活、目标格对齐 0px（rAF 重定位机制证有效）
  - 真 ZK：crossOriginIsolated=true、引擎 163ms 就绪、真实 Aleo 地址
- [ ] 部署静态托管 **动作待执行**（沙箱拦截网络/删除，由用户本地跑；步骤见 DEPLOY.md + 下方发布指南）
- [x] 发布缺口清单已出（见下「遗留」）

### 发布操作（用户本地执行，沙箱不可为）
- **itch.io**：`npm run package:itch` → 网页端 Project → Upload → Embed Options 勾 SharedArrayBuffer support、Frame Options allowed
- **GitHub Pages**：`base:"./"` 已保子路径不 404；`_headers`/coi-serviceworker 兜底跨源隔离；推 `web-app/dist` 到 gh-pages
- **CloudStudio**：本地 Static Site 部署 `web-app/dist`
- 各平台真 ZK 可用性见 DEPLOY.md 第 76–81 行表格；降级态均仍可玩

### 遗留（非阻断）
- [ ] `web-app/worker.js` 手写死代码（零引用，渡链确认）→ 用户拒删，建议后续手动删；dist 中 724KB worker-chunk 是 SDK 内部线程池，不能删
- [ ] `leo/` 多人链上逻辑未接前端（ZK 目前单机自验，多人对战才是 ZK 真正价值）
- [ ] 真 ZK 依赖线上跨源隔离；部分托管平台降级态体验
- [ ] 网格键盘可达性（web-ui 标注遗留）
- [ ] 375px 真机视觉复核（沙箱无法目测，需用户本地过一眼）

## 上架路线（四轴倒推）
- **体验轴**：对手变聪明（狩猎 AI）/ 加音效手感 / 视觉打磨
- **产品轴**：ZK 故事讲清楚——玩家只需懂"我的船位被加密保护"，不需要懂密码学
- **商业轴**：目前无变现（Web 一般跳商店/广告，本作无 IAP）
- **技术轴**：接通 `leo/` 多人 → ZK 才真有用；`vite build` 静态包 + 部署 itch.io/CloudStudio

## 禁用操作
- 不灰盒交付（方法论 2.0）
- 不魔改 `@provablehq/sdk` 当成品核心
- ZK 证明逻辑改动须先在 `leo/` 与前端对齐
- 3D 渲染（Three.js）本期不适用——本作为 2D；如未来做海洋/舰船视觉升级再议
