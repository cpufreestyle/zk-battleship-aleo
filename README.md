# 隐海战舰 — Shadow Fleet

> ZK Battleship on Aleo — Zero-Knowledge Naval Combat
>
> Built for [Aleo Hackathon](https://hackathon.xyz/events/public/e7ad6199-0078-42ee-9846-b82c385e4c0e) · GameFi & SocialFi Track

**🔗 Live Demo**: https://shadowfleet.vercel.app

---

## 🌐 语言 / Language

- [中文](#-中文)
- [English](#-english)

---

## 📖 中文

### 🎯 这是什么？

隐海战舰是一款隐私保护战舰游戏，战舰位置通过 Aleo 上的**零知识证明**保护。玩家可以验证命中/未命中结果正确，**且永远不暴露**战舰放置位置。

### ✅ 已部署至 Aleo 测试网

- **程序 ID**: `shadowfleet.aleo`
- **部署交易**: [`at1y8dx5envrqxkna07xhny3eg6fmh9vsy3mz6nc5cenxmtckdm2qqsuesdey`](https://www.aleo.network/)
- **verify_hit 链上交易**: [`at1yal6nvg3t7ukvfe9g7nm48lxe945rj2xp5jr53k5ux0ql9czmcqqrnyxnu`](https://www.aleo.network/)
- **演示视频**: `demo.webm`（浏览器内 ZK 证明生成演示）

### 🔐 ZK 隐私原理

```
玩家 A 放置战舰 → ships 位串（私有输入）
                        ↓
玩家 B 开火 → mask（公开输入）
                        ↓
Aleo ZK 程序: verify_hit(ships, mask) → ships & mask
                        ↓
ZK 证明: "计算正确"（ships 保持加密）
                        ↓
结果: 命中或未命中（公开输出）
```

- **私有输入**: `ships`（25 位战舰位置位串）— 永不泄露
- **公开输入**: `mask`（开火单元格）— 双方可见
- **公开输出**: `ships & mask`（非零 = 命中，零 = 未命中）
- **ZK 证明**: 密码学保证计算正确，**不暴露 `ships`**

### 🏗 架构

```
zk-battleship-aleo/
├── leo/
│   ├── src/main.leo       # Leo 程序（ZK 验证 + 链上交易）
│   └── program.json       # Leo 项目配置
├── web-app/
│   ├── index.html         # 游戏页面
│   ├── main.js            # 入口 + 初始化
│   ├── i18n.js            # 中英文双语字典
│   ├── sound.js           # 音效引擎（Web Audio API）
│   ├── state.js           # 游戏状态管理
│   ├── game.js            # 游戏逻辑 + ZK 证明集成
│   ├── render.js          # 渲染函数（部分 DOM 更新）
│   ├── zk.js              # Aleo SDK 初始化 + ZK 执行
│   ├── worker.js          # Web Worker（多线程 ZK 证明生成）
│   ├── deploy.mjs         # 测试网部署脚本
│   ├── style.css          # 海战主题 UI（响应式）
│   ├── vite.config.js     # Vite 配置（WASM + COOP/COEP 头）
│   └── package.json
├── demo.webm              # 演示视频
└── start.sh               # 开发服务器启动脚本
```

### 🚀 快速开始

#### 前置要求

- Node.js v22+（不推荐 v24，存在 npm 问题）
- npm

#### 本地运行

```bash
cd web-app
npm install
npm run dev
```

浏览器打开 http://localhost:5173

#### 部署到 Aleo 测试网

```bash
# 先从 https://faucet.aleo.org 获取测试网信用
cd web-app
node deploy.mjs <你的私钥>
```

或使用 Leo CLI：

```bash
export PRIVATE_KEY=<你的私钥>
cd leo
leo deploy --network testnet --endpoint https://api.provable.com/v2 --path . -y --broadcast
```

### 🎮 玩法

1. **放置战舰**: 在 5×5 网格上点击放置 3 艘战舰（驱逐舰: 3 格，护卫舰: 2 格，潜水艇: 2 格）。点击「旋转方向」切换横/纵向。

2. **战斗**: 点击敌方海域格子开火。每次射击通过 Aleo WASM 运行时触发**真实 ZK 证明生成**。

3. **验证隐私**: 查看底部证明面板 — 每次射击生成 ZK 证明，显示结果正确且战舰位置保持加密 (🔒)。

4. **获胜**: 击沉所有敌方战舰即可获胜！所有结果均经过密码学验证。

#### 游戏特色功能

- **⚔️ 三种难度**: 简单（随机射击）/ 普通（命中后追踪）/ 困难（智能追踪 + 奇偶策略）
- **🔥 连击系统**: 命中后可继续射击，未命中才轮到对手
- **📡 ZK 雷达扫描**: 使用 ZK 证明扫描 3×3 区域，获知战舰数量但不暴露位置
- **🏅 成就系统**: 首杀、三连击、五连击、完美胜利等
- **📊 战绩统计**: 胜率、命中率、回合数等数据持久化
- **🔊 音效**: 基于 Web Audio API 的射击/命中/未命中音效
- **⚙️ 中英文切换**: 游戏内设置面板一键切换语言，支持 localStorage 持久化

### 🔬 ZK 证明详情

游戏使用三个 Aleo ZK 函数：

#### `verify_hit(ships: u32.private, mask: u32.public) → u32`
计算 `ships & mask`。非零结果 = 命中。`ships` 位串是**私有输入** — ZK 证明验证 AND 运算正确，不暴露战舰位置。

#### `verify_victory(ships: u32.private, hits: u32.public) → u32`
计算 `ships & hits`。如果结果等于 `ships`，则所有战舰被击沉。战舰位置保持私有。

#### `verify_scan(ships: u32.private, scan_mask: u32.public) → u32`
计算 `ships & scan_mask`。返回扫描区域内战舰格数，不暴露具体位置。

### 🛠 技术栈

| 组件 | 技术 |
|------|------|
| ZK 证明 | Aleo snarkVM (WASM) |
| SDK | @provablehq/sdk |
| 前端 | Vanilla JS + Vite（ES 模块化） |
| 语言 | Aleo Instructions / Leo v4.4.1 |
| 隐私 | 零知识证明 (zk-SNARKs) |

### 📄 许可证

MIT

---

## 📖 English

### 🎯 What Is This?

Shadow Fleet is a privacy-preserving Battleship game where ship positions are protected by **zero-knowledge proofs** on Aleo. Players can verify that hit/miss results are correct **without ever revealing** their ship placements.

### ✅ Deployed on Aleo Testnet

- **Program ID**: `shadowfleet.aleo`
- **Deploy TX**: [`at1y8dx5envrqxkna07xhny3eg6fmh9vsy3mz6nc5cenxmtckdm2qqsuesdey`](https://www.aleo.network/)
- **verify_hit On-chain TX**: [`at1yal6nvg3t7ukvfe9g7nm48lxe945rj2xp5jr53k5ux0ql9czmcqqrnyxnu`](https://www.aleo.network/)
- **Demo Video**: `demo.webm` (shows ZK proof generation in browser)

### 🔐 How ZK Privacy Works

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

### 🏗 Architecture

```
zk-battleship-aleo/
├── leo/
│   ├── src/main.leo       # Leo program (ZK verification + on-chain transitions)
│   └── program.json       # Leo project config
├── web-app/
│   ├── index.html         # Game page
│   ├── main.js            # Entry point + initialization
│   ├── i18n.js            # Bilingual (zh/en) dictionary
│   ├── sound.js           # Sound engine (Web Audio API)
│   ├── state.js           # Game state management
│   ├── game.js            # Game logic + ZK proof integration
│   ├── render.js          # Render functions (partial DOM updates)
│   ├── zk.js              # Aleo SDK initialization + ZK execution
│   ├── worker.js          # Web Worker (for multithreaded ZK proof generation)
│   ├── deploy.mjs         # Testnet deployment script
│   ├── style.css          # Naval combat themed UI (responsive)
│   ├── vite.config.js     # Vite config (WASM + COOP/COEP headers)
│   └── package.json
├── demo.webm              # Demo video
└── start.sh               # Dev server launcher
```

### 🚀 Quick Start

#### Prerequisites

- Node.js v22+ (v24 not recommended due to npm issues)
- npm

#### Run Locally

```bash
cd web-app
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

#### Deploy to Aleo Testnet

```bash
# Get testnet credits from https://faucet.aleo.org first
cd web-app
node deploy.mjs <your_private_key>
```

Or use Leo CLI:

```bash
export PRIVATE_KEY=<your_private_key>
cd leo
leo deploy --network testnet --endpoint https://api.provable.com/v2 --path . -y --broadcast
```

### 🎮 How to Play

1. **Place Ships**: Click cells on your 5×5 grid to place 3 ships (Destroyer: 3 cells, Frigate: 2 cells, Submarine: 2 cells). Use Rotate button to change direction.

2. **Battle**: Click cells on the Enemy Waters grid to fire. Each shot triggers a **real ZK proof generation** via the Aleo WASM runtime.

3. **Verify Privacy**: Watch the proof panel at the bottom — each shot generates a ZK proof showing the result is correct while ship positions remain encrypted (🔒).

4. **Win**: Sink all enemy ships to win! All results are cryptographically verified.

#### Game Features

- **⚔️ Three Difficulty Levels**: Easy (random shots) / Normal (hunt adjacent after hit) / Hard (smart tracking + parity strategy)
- **🔥 Combo System**: Hit = keep firing, miss = opponent's turn
- **📡 ZK Radar Scan**: Use ZK proof to scan a 3×3 area — reveals ship count without exposing positions
- **🏅 Achievements**: First Blood, Triple Combo, Pentakill, Perfect Victory, and more
- **📊 Battle Stats**: Win rate, hit rate, turns — persisted via localStorage
- **🔊 Sound Effects**: Web Audio API powered fire/hit/miss sounds
- **⚙️ Bilingual Toggle**: In-game settings panel for zh/en switching with localStorage persistence

### 🔬 ZK Proof Details

The game uses three Aleo ZK functions:

#### `verify_hit(ships: u32.private, mask: u32.public) → u32`
Computes `ships & mask`. Non-zero result = HIT. The `ships` bitstring is a **private input** — the ZK proof proves the AND operation was computed correctly without revealing which cells contain ships.

#### `verify_victory(ships: u32.private, hits: u32.public) → u32`
Computes `ships & hits`. If the result equals `ships`, all ships are sunk. Again, ship positions remain private.

#### `verify_scan(ships: u32.private, scan_mask: u32.public) → u32`
Computes `ships & scan_mask`. Returns the count of ship cells in the scanned area without revealing exact positions.

### 🛠 Tech Stack

| Component | Technology |
|-----------|-----------|
| ZK Proofs | Aleo snarkVM (WASM) |
| SDK | @provablehq/sdk |
| Frontend | Vanilla JS + Vite (ES Modules) |
| Language | Aleo Instructions / Leo v4.4.1 |
| Privacy | Zero-Knowledge Proofs (zk-SNARKs) |

### 📋 Hackathon Submission

- **Track**: GameFi & SocialFi
- **Theme**: Programmable Privacy
- **Privacy Feature**: Ship positions are private inputs to ZK programs — verifiable but never revealed
- **Built with**: Aleo SDK, Leo/Aleo Instructions, Vanilla JS
- **Demo Video**: `demo.webm`
- **GitHub**: https://github.com/cpufreestyle/zk-battleship-aleo

### 📄 License

MIT
