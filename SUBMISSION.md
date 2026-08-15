# 隐海战舰 Shadow Fleet — 报名提交文案

> 直接复制粘贴到 hackathon.xyz 报名表单的各字段

---

## 项目名称

```
隐海战舰 Shadow Fleet — ZK Battleship on Aleo
```

---

## 赛道

```
GameFi & SocialFi
```

---

## 一句话简介（如有此字段）

```
基于 Aleo 零知识证明的隐私战舰棋：对手能验证每次命中结果、却永远看不到你的船在哪。可编程隐私的游戏化落地。
```

---

## 项目简介 / Description

```
隐海战舰（Shadow Fleet）是一款基于 Aleo 区块链零知识证明技术的隐私保护战舰对战游戏。

【核心价值】
战舰位置作为 ZK 程序的私有输入被加密保护——每次开火由 Aleo snarkVM 在浏览器内生成零知识证明，对手能验证命中/未中结果正确，却永远看不到船位。这把"公平"从信任人变成了信任密码学，是 Programmable Privacy 在 GameFi 领域的落地实践。

【3 个 ZK 函数（已上链）】
• verify_hit(ships.private, mask.public) — 命中验证，船位永不泄露
• verify_victory(ships.private, hits.public) — 胜利验证
• verify_scan(ships.private, scan_mask.public) — 雷达扫描，返回区域内战舰数量但不暴露位置
• Leo 程序 shadowfleet.aleo 已部署至 Aleo testnet，verify_hit 链上执行确认

【3 种对战模式】
• 🤖 vs AI — 3 种难度（随机/追踪/奇偶策略），三局两胜
• 👥 同设备 P2P — 两人轮流，隐私屏交接 + ZK 证明防偷看
• 🌐 互联网联机 — PeerJS/WebRTC 房间号联机，船位不经过任何服务器

【技术亮点】
• 三层 ZK 降级（L1 共享内存探测 → L2 Worker 动态加载 SDK → L3 JS 本地校验），永不白屏
• WebGPU 加速 ZK 位运算
• 区块链教育系统：知识问答（答对获游戏奖励）+ ZK 实验室（隐私双视角演示 + 区块链验证5步动画）+ 概念卡片
• 武器/天气/舰船技能/ELO 排名/成就系统/战绩统计

【技术栈】
Aleo snarkVM (WASM) · Leo v4.4.1 · @provablehq/sdk · PeerJS/WebRTC · WebGPU · Vite 6 · Vanilla JS

【链上部署】
• Program ID: shadowfleet.aleo
• Deploy TX: at1y8dx5envrqxkna07xhny3eg6fmh9vsy3mz6nc5cenxmtckdm2qqsuesdey
• verify_hit On-chain TX: at1yal6nvg3t7ukvfe9g7nm48lxe945rj2xp5jr53k5ux0ql9czmcqqrnyxnu
```

---

## Demo URL

```
https://zk-battleship-aleo-fix.vercel.app
```

---

## GitHub

```
https://github.com/cpufreestyle/zk-battleship-aleo
```

---

## 演示视频

```
https://github.com/cpufreestyle/zk-battleship-aleo/releases/tag/v1.0.0
```
（v1.0.0 release 资产 demo.webm，含 AI 中文语音解说，2分20秒）

---

## 团队信息

```
团队名称: MichaelQiu
参赛者: MichaelQiu
团队规模: 1人
```

---

## 亮点关键词（如有标签字段）

```
零知识证明, ZK, Aleo, GameFi, 隐私, 可编程隐私, snarkVM, Leo, WebRTC, WebGPU
```
