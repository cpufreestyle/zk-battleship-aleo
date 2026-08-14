# Shadow Fleet (隐海战舰) — Demo Day 演示脚本

> Aleo Hackathon · GameFi & SocialFi Track · 演示时长 3 分钟

---

## 🎯 开场 30 秒 — 问题 + ZK 方案

> "战棋游戏的核心信任问题：**如何证明我击中了你，却不暴露我的船在哪？**
> 普通游戏靠信任，链上游戏靠公开——但公开就泄露军情。
> 我们用 **Aleo 零知识证明** 解决：对方能验证结果正确，密码学保证看不到我的部署。

**名言**: 「隐私不应是功能，而应是互联网的默认选项」(主办方主题)

---

## 🎮 核心演示 90 秒 — 三种模式现场跑

### 演示点 1: 开始页
- 三种对战模式：vs AI / 同设备 P2P / 互联网联机
- 难度选择 + 舰队配置
- 点「开始对战」

### 演示点 2: 随机部署 + 开火
- 🎲 随机部署舰队
- 开火 → 展示 **ZK PROOF 弹窗**（⚡ → ✓ VERIFIED + proof hash）
- 右上角 **区块链状态栏**：ZK证实数 / 验证率 / Aleo地址实时增长

### 演示点 3: 结算页
- **Blockchain Summary**: ZK 生成数 / 验证数 / 验证率 100%
- 本局成就 + 效率评级

---

## 🧠 技术亮点 60 秒 — 三层降级 + 隐私

> "有些技术是锦上添花，三层降级是**必须工程**。

- **三层 ZK 降级**：探测 → Worker → JS 兜底，永不白屏
- **WebGPU 加速**：可用时 GPU 跑 ZK 位运算
- **同设备对阵**：屏幕遮蔽 + ZK 验证 —— *这是评审能亲自体验的隐私演示*
- **链上已部署**：`shadowfleet.aleo`，verify_hit 链上确认执行

---

## ❓ 评审问答准备 (5 个高频)

**Q1: 为什么用 bitstring 而不是 Merkle tree？**
> bitstring 用 25 位布尔掩码精确表达船位，`ships & mask` 一条指令完成命中判定 —— 对 u32 输入，snarkVM 证明代价极低。ZKP 本质是将计算转为证明，bitstring 的 AND 是最小可证单元。

**Q2: 多人时船位上链会不会泄露？**
> 不会。在线对战走 PeerJS/WebRTC，**船位明文不上链**；ZK 程序在本地对私有 `ships` 生成证明，输出 `ships & mask ← 公开的是结果不是输入`。链上 `Board` record 只存 ownership 与剩余格数。

**Q3: 宕掉或弱网会怎样？**
> 三层降级：L1 探测不过 → coi-serviceworker 重载 → 连 SW 也不行就走 L3 本地校验，游戏 100% 可玩，只是证明从真 ZK 降为本地。

**Q4: 和传统双玩家战棋比多了什么？**
> 每个开火都是零知识证明，公开输出来源。让"公平"从**信任人**变为**信任密码学** —— 这是 Programmable Privacy 的核心。

**Q5: 未来路线？**
> ① 真链上多人（place_fleet/fire 已写 Leo transition）② 全局排行榜与成就 ③ 移动端适配。

---

## 🚀 收尾 15 秒

> "这就是隐海舰队 —— 把零知识化作战术决策的公平基石。PC 可玩，GitHub 开源，网上已部署。」
**链接**: https://zk-battleship-aleo-fix.vercel.app · github.com/cpufreestyle/zk-battleship-aleo