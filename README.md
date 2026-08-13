# 隐海战舰 — Shadow Fleet

> ZK Battleship on Aleo — Zero-Knowledge Naval Combat
>
> Built for [Aleo Hackathon](https://hackathon.xyz/events/public/e7ad6199-0078-42ee-9846-b82c385e4c0e) · GameFi & SocialFi Track

**🔗 Live Demo**: https://shadowfleet.vercel.app

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
| **演示视频 / Demo Video** | `demo.webm`（浏览器内 ZK 证明生成演示 / shows ZK proof generation in browser） |

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

| 项目 / Item | 中文 | English |
|---|---|---|
| **私有输入 / Private input** | `ships`（25 位战舰位置位串）— 永不泄露 | `ships` (25-bit bitstring of ship positions) — never revealed |
| **公开输入 / Public input** | `mask`（开火单元格）— 双方可见 | `mask` (which cell was fired at) — visible to both players |
| **公开输出 / Public output** | `ships & mask`（非零 = 命中，零 = 未命中）| `ships & mask` (non-zero = hit, zero = miss) |
| **ZK 证明 / ZK proof** | 密码学保证计算正确，**不暴露 `ships`** | Cryptographically guarantees the computation was correct **without exposing `ships`** |

---

## 🏗 架构 / Architecture

```
zk-battleship-aleo/
├── leo/
│   ├── src/main.leo       # Leo 程序 / Leo program (ZK verification + on-chain transitions)
│   └── program.json       # Leo 项目配置 / Leo project config
├── web-app/
│   ├── index.html         # 游戏页面 / Game page
│   ├── main.js            # 入口 + 初始化 / Entry point + initialization
│   ├── i18n.js            # 中英文双语字典 / Bilingual (zh/en) dictionary
│   ├── sound.js           # 音效引擎 / Sound engine (Web Audio API)
│   ├── state.js           # 游戏状态管理 / Game state management
│   ├── game.js            # 游戏逻辑 + ZK 证明集成 / Game logic + ZK proof integration
│   ├── render.js          # 渲染函数（部分 DOM 更新）/ Render functions (partial DOM updates)
│   ├── zk.js              # Aleo SDK 初始化 + ZK 执行 / Aleo SDK init + ZK execution
│   ├── worker.js          # Web Worker（多线程 ZK 证明生成）/ Multithreaded ZK proof generation
│   ├── deploy.mjs         # 测试网部署脚本 / Testnet deployment script
│   ├── style.css          # 海战主题 UI（响应式）/ Naval combat themed UI (responsive)
│   ├── vite.config.js     # Vite 配置 / Vite config (WASM + COOP/COEP headers)
│   └── package.json
├── demo.webm              # 演示视频 / Demo video
└── start.sh               # 开发服务器启动脚本 / Dev server launcher
```

---

## 🚀 快速开始 / Quick Start

### 前置要求 / Prerequisites

- Node.js v22+（不推荐 v24，存在 npm 问题 / v24 not recommended due to npm issues）
- npm

### 本地运行 / Run Locally

```bash
cd web-app
npm install
npm run dev
```

浏览器打开 http://localhost:5173 / Open http://localhost:5173 in your browser.

### 部署到 Aleo 测试网 / Deploy to Aleo Testnet

```bash
# 先从 https://faucet.aleo.org 获取测试网信用
# Get testnet credits from https://faucet.aleo.org first
cd web-app
node deploy.mjs <your_private_key>
```

或使用 Leo CLI / Or use Leo CLI:

```bash
export PRIVATE_KEY=<your_private_key>
cd leo
leo deploy --network testnet --endpoint https://api.provable.com/v2 --path . -y --broadcast
```

---

## 🎮 玩法 / How to Play

1. **放置战舰 / Place Ships**: 在 5×5 网格上点击放置 3 艘战舰（驱逐舰: 3 格，护卫舰: 2 格，潜水艇: 2 格）。点击「旋转方向」切换横/纵向。 / Click cells on your 5×5 grid to place 3 ships (Destroyer: 3 cells, Frigate: 2 cells, Submarine: 2 cells). Use Rotate button to change direction.

2. **战斗 / Battle**: 点击敌方海域格子开火。每次射击通过 Aleo WASM 运行时触发**真实 ZK 证明生成**。 / Click cells on the Enemy Waters grid to fire. Each shot triggers a **real ZK proof generation** via the Aleo WASM runtime.

3. **验证隐私 / Verify Privacy**: 查看底部证明面板 — 每次射击生成 ZK 证明，显示结果正确且战舰位置保持加密 (🔒)。 / Watch the proof panel at the bottom — each shot generates a ZK proof showing the result is correct while ship positions remain encrypted (🔒).

4. **获胜 / Win**: 击沉所有敌方战舰即可获胜！所有结果均经过密码学验证。 / Sink all enemy ships to win! All results are cryptographically verified.

---

### 🎮 游戏特色功能 / Game Features

| 功能 / Feature | 中文 | English |
|---|---|---|
| ⚔️ **难度 / Difficulty** | 简单（随机射击）/ 普通（命中后追踪）/ 困难（智能追踪 + 奇偶策略） | Easy (random shots) / Normal (hunt adjacent after hit) / Hard (smart tracking + parity strategy) |
| 🔥 **连击系统 / Combo System** | 命中后可继续射击，未命中才轮到对手 | Hit = keep firing, miss = opponent's turn |
| 📡 **ZK 雷达扫描 / ZK Radar Scan** | 使用 ZK 证明扫描 3×3 区域，获知战舰数量但不暴露位置 | Use ZK proof to scan a 3×3 area — reveals ship count without exposing positions |
| 🏅 **成就系统 / Achievements** | 首杀、三连击、五连击、完美胜利等 | First Blood, Triple Combo, Pentakill, Perfect Victory, and more |
| 📊 **战绩统计 / Battle Stats** | 胜率、命中率、回合数等数据持久化 | Win rate, hit rate, turns — persisted via localStorage |
| 🔊 **音效 / Sound Effects** | 基于 Web Audio API 的射击/命中/未命中音效 | Web Audio API powered fire/hit/miss sounds |
| ⚙️ **中英文切换 / Bilingual Toggle** | 游戏内设置面板一键切换语言，支持 localStorage 持久化 | In-game settings panel for zh/en switching with localStorage persistence |

---

## 🔬 ZK 证明详情 / ZK Proof Details

游戏使用三个 Aleo ZK 函数 / The game uses three Aleo ZK functions:

### `verify_hit(ships: u32.private, mask: u32.public) → u32`

**中文**: 计算 `ships & mask`。非零结果 = 命中。`ships` 位串是**私有输入** — ZK 证明验证 AND 运算正确，不暴露战舰位置。

**English**: Computes `ships & mask`. Non-zero result = HIT. The `ships` bitstring is a **private input** — the ZK proof proves the AND operation was computed correctly without revealing which cells contain ships.

### `verify_victory(ships: u32.private, hits: u32.public) → u32`

**中文**: 计算 `ships & hits`。如果结果等于 `ships`，则所有战舰被击沉。战舰位置保持私有。

**English**: Computes `ships & hits`. If the result equals `ships`, all ships are sunk. Again, ship positions remain private.

### `verify_scan(ships: u32.private, scan_mask: u32.public) → u32`

**中文**: 计算 `ships & scan_mask`。返回扫描区域内战舰格数，不暴露具体位置。

**English**: Computes `ships & scan_mask`. Returns the count of ship cells in the scanned area without revealing exact positions.

---

## 🛠 技术栈 / Tech Stack

| 组件 / Component | 技术 / Technology |
|---|---|
| ZK 证明 / ZK Proofs | Aleo snarkVM (WASM) |
| SDK | @provablehq/sdk |
| 前端 / Frontend | Vanilla JS + Vite（ES 模块化 / ES Modules） |
| 语言 / Language | Aleo Instructions / Leo v4.4.1 |
| 隐私 / Privacy | 零知识证明 / Zero-Knowledge Proofs (zk-SNARKs) |

---

## 📋 Hackathon 提交 / Hackathon Submission

| 项目 / Item | 内容 / Value |
|---|---|
| **赛道 / Track** | GameFi & SocialFi |
| **主题 / Theme** | Programmable Privacy |
| **隐私特性 / Privacy Feature** | 战舰位置是 ZK 程序的私有输入 — 可验证但永不泄露 / Ship positions are private inputs to ZK programs — verifiable but never revealed |
| **构建工具 / Built with** | Aleo SDK, Leo/Aleo Instructions, Vanilla JS |
| **演示视频 / Demo Video** | `demo.webm` |
| **GitHub** | https://github.com/cpufreestyle/zk-battleship-aleo |

---

## 📄 许可证 / License

MIT
