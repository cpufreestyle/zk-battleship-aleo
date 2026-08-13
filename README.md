# 隐海战舰 — Shadow Fleet

> ZK Battleship on Aleo — Zero-Knowledge Naval Combat
>
> Built for [Aleo Hackathon](https://hackathon.xyz/events/public/e7ad6199-0078-42ee-9846-b82c385e4c0e) · GameFi & SocialFi Track

**🔗 Live Demo**: https://zk-battleship-aleo-fix.vercel.app

---

## 🎯 项目简介 / What Is This?

**中文**: 隐海战舰是一款隐私保护战舰游戏，战舰位置通过 Aleo 上的**零知识证明**保护。玩家可以验证命中/未命中结果正确，**且永远不暴露**战舰放置位置。

**English**: Shadow Fleet is a privacy-preserving Battleship game where ship positions are protected by **zero-knowledge proofs** on Aleo. Players can verify that hit/miss results are correct **without ever revealing** their ship placements.

---

## ✅ 已部署至 Aleo 测试网 / Deployed on Aleo Testnet

| | |
|---|---|
| **程序 ID / Program ID** | `shadowfleet.aleo` |
| **部署交易 / Deploy TX** | [`at1y8dx5envrqxkna07xhny3eg6fmh9vsy3mz6nc5cenxmtckdm2qqsuesdey`](https://www.aleo.network/) |
| **verify_hit 链上交易 / On-chain TX** | [`at1yal6nvg3t7ukvfe9g7nm48lxe945rj2xp5jr53k5ux0ql9czmcqqrnyxnu`](https://www.aleo.network/) |
| **演示视频 / Demo Video** | `demo.webm` |

---

## 🔐 ZK 隐私原理 / How ZK Privacy Works

```
Player A places ships → ships bitstring (PRIVATE INPUT)
                        ↓
Player B fires at cell → mask (PUBLIC INPUT)
                        ↓
Aleo ZK Program: verify_hit(ships, mask) → ships & mask
                        ↓
ZK PROOF: "The computation is correct" (ships remain ENCRYPTED)
                        ↓
Result: HIT or MISS (PUBLIC OUTPUT)
```

- **Private input**: `ships` (25-bit bitstring of ship positions) — never revealed
- **Public input**: `mask` (which cell was fired at) — visible to both players
- **Public output**: `ships & mask` (non-zero = hit, zero = miss)
- **ZK proof**: Cryptographically guarantees the computation was correct **without exposing `ships`**

---

## 🎮 游戏特色功能 / Game Features

| 功能 / Feature | 说明 / Description |
|---|---|
| 🔒 **3 个 ZK 函数 / 3 ZK Functions** | `verify_hit`（命中验证）/ `verify_victory`（胜利验证）/ `verify_scan`（雷达扫描）— 全部通过 Aleo snarkVM 在浏览器中生成真实零知识证明 |
| 🔥 **连击系统 / Combo System** | 命中后可继续射击，未命中才轮到对手（经典战棋规则） |
| 📡 **ZK 雷达扫描 / ZK Radar Scan** | 每局 1 次，扫描 3×3 区域，ZK 证明返回区域内战舰数量，**不暴露具体位置** |
| 🏅 **成就系统 / Achievements** | 首杀 / 三连击 / 五连击 / 完美胜利 / 百发百中 |
| ⚡ **ZK 证明动画 / ZK Proof Overlay** | 每次开火时显示区块链风格弹窗："ZK PROOF GENERATING → ✓ VERIFIED"，含 proof hash |
| 📊 **区块链状态栏 / Blockchain Bar** | 持久显示 ZK 证明数 / 验证率 / Aleo 钱包地址 / 网络类型 / 程序 ID |
| 🤖 **AI 战术助手 / AI Tactical Panel** | MCP 驱动的战场态势分析与推荐落点 |
| ⚡ **WebGPU 加速 / WebGPU Acceleration** | 自动检测 WebGPU，可用时 GPU 加速 ZK 运算 |
| 🎓 **新手教程 / Tutorial** | 5 步交互式引导，含迷你棋盘演示 |
| ⚙️ **速度控制 / Speed Control** | 0.5×–8× 游戏速度调节 |
| 🔊 **程序化音效 / Procedural SFX** | Web Audio API 合成开火/命中/击沉/胜利音效 |
| 💥 **特效层 / FX Layer** | 屏幕震动 / 爆炸 / 水波 / 横幅预警 |
| 🛡️ **三层 ZK 降级 / 3-Layer ZK Degradation** | L1 共享内存探测 → L2 动态加载 SDK → L3 本地校验降级，**永不白屏** |

---

## 🏗 架构 / Architecture

```
zk-battleship-aleo/
├── index.html              # 游戏页面 / Game page
├── main.js                 # 游戏逻辑 + ZK 证明集成 / Game logic + ZK proof integration
├── zk.js                   # Aleo SDK 初始化 + 三层降级策略 / Aleo SDK init + 3-layer degradation
├── worker.js               # Web Worker（ZK 证明生成不阻塞主线程）/ ZK proofs in Worker thread
├── gpu.js                  # WebGPU ZK 加速 / WebGPU ZK acceleration
├── mcp.js                  # AI 战术助手面板 / MCP AI tactical panel
├── state-mcp.js            # 状态桥接 / State bridge to MCP
├── audio.js                # 程序化音效引擎 / Procedural audio engine
├── fx.js                   # 特效层 / FX layer (shake/explosions/ripples)
├── style.css               # 海战主题 UI / Naval combat themed UI
├── vite.config.js          # Vite 配置（WASM + COOP/COEP）/ Vite config
├── vercel.json             # Vercel COOP/COEP 响应头 / Vercel headers
├── deploy.mjs              # 测试网部署脚本 / Testnet deployment script
├── package.json
├── leo/                    # Leo 程序 / Leo program
│   ├── src/main.leo       # 3 个 ZK 函数 + 链上 transitions / 3 ZK functions + on-chain transitions
│   └── program.json
├── public/                 # 静态资源 / Static assets
│   ├── coi-serviceworker.js  # 跨源隔离 polyfill / Cross-origin isolation polyfill
│   ├── _headers            # Netlify/CF Pages COOP/COEP
│   └── icons/              # Favicon
├── scripts/                # 构建脚本 / Build scripts
│   ├── clean.mjs
│   ├── serve-dist.mjs
│   ├── package-itch.mjs
│   └── record-demo.mjs     # Playwright 录屏脚本 / Playwright demo recorder
├── demo.webm               # 演示视频 / Demo video
├── DEPLOY.md               # 构建部署手册 / Build & deploy runbook
├── PUBLISH.md              # 发布清单 / Publishing checklist
└── start.sh                # 开发服务器启动 / Dev server launcher
```

---

## 🚀 快速开始 / Quick Start

### 本地运行 / Run Locally

```bash
npm install --include=dev
npm run dev
```

浏览器打开 http://localhost:5173

### 构建生产版本 / Build for Production

```bash
npm run build      # 产出 dist/
```

首屏约 35KB（gzip 14KB）。21MB Aleo WASM **懒加载**，ZK 不可用时不下载。

### 部署到 Aleo 测试网 / Deploy to Aleo Testnet

```bash
# 先从 https://faucet.aleo.org 获取测试网信用
node deploy.mjs <your_private_key>
```

或使用 Leo CLI / Or use Leo CLI:

```bash
export PRIVATE_KEY=<your_private_key>
cd leo
leo deploy --network testnet --endpoint https://api.provable.com/v2 --path . -y --broadcast
```

---

## 🔬 ZK 证明详情 / ZK Proof Details

游戏使用三个 Aleo ZK 函数 / The game uses three Aleo ZK functions:

### `verify_hit(ships: u32.private, mask: u32.public) → u32`
Computes `ships & mask`. Non-zero = HIT. `ships` is a **private input** — the ZK proof proves the AND operation was correct without revealing which cells contain ships.

### `verify_victory(ships: u32.private, hits: u32.public) → u32`
Computes `ships & hits`. If result equals `ships`, all ships are sunk. Ship positions remain private.

### `verify_scan(ships: u32.private, scan_mask: u32.public) → u32`
Computes `ships & scan_mask`. The count of set bits in the result reveals how many ship cells are in the scanned 3×3 area, **without revealing which specific cells** contain ships.

### Aleo Instructions (browser SDK)

```aleo
program shadowfleet.aleo;

function verify_hit:
    input r0 as u32.private;
    input r1 as u32.public;
    and r0 r1 into r2;
    output r2 as u32.private;

function verify_victory:
    input r0 as u32.private;
    input r1 as u32.public;
    and r0 r1 into r2;
    output r2 as u32.private;

function verify_scan:
    input r0 as u32.private;
    input r1 as u32.public;
    and r0 r1 into r2;
    output r2 as u32.private;
```

### Leo Program (on-chain, `leo/src/main.leo`)

```leo
program shadowfleet.aleo {
    @noupgrade constructor() {}

    fn verify_hit(ships: u32, public mask: u32) -> u32 {
        return ships & mask;
    }

    fn verify_victory(ships: u32, public hits: u32) -> u32 {
        return ships & hits;
    }

    fn verify_scan(ships: u32, public scan_mask: u32) -> u32 {
        return ships & scan_mask;
    }

    // On-chain transitions for multiplayer mode
    fn place_fleet(ships: u32, public ship_count: u8, public opponent: address) -> Board { ... }
    fn fire(board: Board, public coordinate: u32) -> (Board, u32) { ... }
    fn check_victory(board: Board) -> (Board, u8) { ... }
}
```

---

## 🛠 技术栈 / Tech Stack

| 组件 / Component | 技术 / Technology |
|---|---|
| ZK 证明 / ZK Proofs | Aleo snarkVM (WASM, in Web Worker) |
| SDK | @provablehq/sdk |
| GPU 加速 / GPU Acceleration | WebGPU (auto-detected, optional) |
| 链上 / On-chain | Leo v4.4.1 / Aleo Instructions |
| 前端 / Frontend | Vanilla JS + Vite 6 |
| 音效 / Audio | Web Audio API (programmatic synthesis) |
| 部署 / Hosting | Vercel (COOP/COEP configured) |

---

## 📋 Hackathon 提交 / Hackathon Submission

| 项目 / Item | 内容 / Value |
|---|---|
| **赛道 / Track** | GameFi & SocialFi |
| **主题 / Theme** | Programmable Privacy |
| **隐私特性 / Privacy Feature** | 战舰位置是 ZK 程序的私有输入 — 可验证但永不泄露 |
| **演示视频 / Demo Video** | `demo.webm` |
| **GitHub** | https://github.com/cpufreestyle/zk-battleship-aleo |

---

## 📄 许可证 / License

MIT
