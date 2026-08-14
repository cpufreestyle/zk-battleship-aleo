/**
 * education.js — 寓教于乐：区块链与加密技术互动教学
 *
 * 三大系统：
 * 1. 知识问答 — 在游戏关键时刻弹出选择题，答对获得游戏奖励
 * 2. ZK 实验室 — 可视化演示零知识证明原理
 * 3. 概念卡片 — 通过游戏行为解锁加密知识卡片
 */

// ===== 1. 知识问答题库 =====
export const QUIZZES = [
  {
    id: "q1",
    trigger: "firstHit", // 第一次命中时弹出
    icon: "🔐",
    question: "在零知识证明中，'私有输入' (private input) 指的是什么？",
    options: [
      "所有人都能看到的公开数据",
      "只有证明者知道、验证者看不到的数据",
      "加密后的随机数",
      "区块链上的交易记录",
    ],
    answer: 1,
    explanation: "私有输入是证明者拥有但不想泄露给验证者的数据。在这个游戏中，你的战舰位置就是私有输入——对手能验证命中结果正确，但看不到你的船在哪。",
    reward: "📡 额外雷达扫描 +1",
    rewardType: "scan",
  },
  {
    id: "q2",
    trigger: "firstScan", // 第一次扫描后弹出
    icon: "📡",
    question: "verify_scan 函数返回了扫描区域内战舰的数量，但不暴露具体位置。这利用了什么特性？",
    options: [
      "数据加密",
      "零知识证明只输出聚合结果，不泄露个体信息",
      "随机数生成",
      "哈希函数",
    ],
    answer: 1,
    explanation: "ZK 证明可以只输出聚合信息（如'有 2 格战舰'），而不泄露构成这个数字的具体位置。这正是隐私计算的核心——你可以验证统计信息，但无法反推个体数据。",
    reward: "🎯 鱼雷 +1",
    rewardType: "torpedo",
  },
  {
    id: "q3",
    trigger: "thirdProof", // 第 3 次 ZK 证明后
    icon: "⛓️",
    question: "为什么每次开火都要生成 ZK 证明并记录在区块链上？",
    options: [
      "为了让游戏更好看",
      "为了防止作弊——证明不可篡改且可验证",
      "为了消耗网络资源",
      "为了让对手看到你的船位",
    ],
    answer: 1,
    explanation: "ZK 证明 + 区块链记录 = 不可篡改 + 可验证。任何人都无法伪造命中结果，因为每一步都有密码学证明。这就是为什么区块链游戏比传统游戏更公平。",
    reward: "⚡ EMP +1",
    rewardType: "emp",
  },
  {
    id: "q4",
    trigger: "firstSunk", // 第一次击沉时
    icon: "💀",
    question: "当一艘船被击沉时，verify_victory 检查 (ships & hits) == ships。这个位运算的含义是？",
    options: [
      "检查船是否还在",
      "检查所有战舰格是否都被命中",
      "生成随机数",
      "加密船位数据",
    ],
    answer: 1,
    explanation: "ships & hits 对船位和命中记录做按位与。如果结果等于 ships 本身，说明每一个船位格都被命中了（所有位都是 1），即全歼。位运算是 ZK 程序中最基础的操作。",
    reward: "📊 额外信息：AI 战局分析已解锁",
    rewardType: "info",
  },
  {
    id: "q5",
    trigger: "victory", // 胜利时
    icon: "🏆",
    question: "zk-SNARK 中的 'SNARK' 代表什么？",
    options: [
      "Secure Network And Routing Key",
      "Succinct Non-interactive ARgument of Knowledge",
      "Secret Number Authentication Random Key",
      "System Node Access Resource Kit",
    ],
    answer: 1,
    explanation: "SNARK = Succinct Non-interactive ARgument of Knowledge（简洁非交互式知识论证）。Succinct（简洁）= 证明很小很快；Non-interactive（非交互）= 不需要来回通信；A K= 证明你知道某个信息但不泄露它。Aleo 用的就是 zk-SNARK。",
    reward: "🎖 排名积分 +50",
    rewardType: "elo",
  },
  {
    id: "q6",
    trigger: "defeat", // 失败时
    icon: "📚",
    question: "在传统战舰游戏中，对手可以偷看你的棋盘来作弊。ZK 版本如何防止这一点？",
    options: [
      "禁止对手看屏幕",
      "船位是 ZK 程序的私有输入，对手只能验证结果，看不到船位",
      "使用密码锁保护棋盘",
      "每次开火后交换设备",
    ],
    answer: 1,
    explanation: "这正是零知识证明的核心价值：证明者（你）知道船的位置，验证者（对手）能验证命中结果正确，但永远无法获知船的具体位置。密码学保证了这一点，不靠信任，靠数学。",
    reward: "🎁 概念卡片解锁：零知识证明",
    rewardType: "card",
  },
];

/** 根据触发条件获取应该弹出的题目 */
export function getQuizForTrigger(trigger, answeredQuizzes) {
  const quiz = QUIZZES.find(q => q.trigger === trigger && !answeredQuizzes.includes(q.id));
  return quiz || null;
}

// ===== 2. ZK 实验室演示 =====
export const ZK_LAB_DEMOS = [
  {
    id: "bitwise_and",
    title: "位运算 AND 演示",
    titleEn: "Bitwise AND Demo",
    icon: "⚙️",
    desc: "这是 verify_hit 的核心运算。看看 ships & mask 如何判断命中",
    // 可视化：5x5 网格，点击切换船位和射击位，实时显示 AND 结果
  },
  {
    id: "privacy",
    title: "隐私保护演示",
    titleEn: "Privacy Demo",
    icon: "🔒",
    desc: "看看对手能验证结果但看不到你的船位",
    // 可视化：左右两个视角，你的视角看到船，对手视角只有命中/未命中
  },
  {
    id: "blockchain",
    title: "区块链验证流程",
    titleEn: "Blockchain Verification",
    icon: "⛓️",
    desc: "一次开火从点击到上链验证的完整流程",
    // 可视化：步骤流 — 点击 → ZK 证明生成 → 上链 → 验证 → 结果
  },
];

// ===== 3. 概念卡片 =====
export const CONCEPT_CARDS = [
  {
    id: "zk_proof",
    icon: "🔐",
    name: "零知识证明",
    nameEn: "Zero-Knowledge Proof",
    desc: "证明你知道某个秘密，但不泄露秘密本身",
    descEn: "Prove you know a secret without revealing it",
    unlockCondition: "完成第一场对战",
    unlockKey: "firstGame",
    detail: "零知识证明（ZKP）是一种密码学协议：证明者向验证者证明某个陈述为真，但不泄露任何额外信息。在这个游戏中，你能证明'我确实把船放在了这些格子里'，但不需要告诉对手具体是哪些格子。",
  },
  {
    id: "private_input",
    icon: "🔑",
    name: "私有输入",
    nameEn: "Private Input",
    desc: "ZK 程序中不公开的输入数据",
    descEn: "Hidden input data in a ZK program",
    unlockCondition: "第一次命中敌舰",
    unlockKey: "firstHit",
    detail: "在 ZK 程序中，输入分为公开和私有两种。你的船位 bitstring 是私有输入——程序用它来计算命中结果，但验证者只能看到输出（命中/未命中），看不到输入值。",
  },
  {
    id: "bitwise_op",
    icon: "⚙️",
    name: "位运算",
    nameEn: "Bitwise Operation",
    desc: "ZK 程序最基础的运算：AND/OR/XOR",
    descEn: "Basic ZK operation: AND/OR/XOR",
    unlockCondition: "使用雷达扫描",
    unlockKey: "firstScan",
    detail: "verify_hit 用 AND 运算：ships & mask。船位是二进制位串（1=有船，0=无船），射击位置也是位串。AND 运算后非零=命中。ZK 证明验证这个 AND 被正确执行，但不暴露 ships 的值。",
  },
  {
    id: "snark",
    icon: "⚡",
    name: "zk-SNARK",
    nameEn: "zk-SNARK",
    desc: "简洁非交互式知识论证",
    descEn: "Succinct Non-interactive ARgument of Knowledge",
    unlockCondition: "生成 5 个 ZK 证明",
    unlockKey: "fiveProofs",
    detail: "SNARK 是最流行的 ZK 方案之一。S=Succinct（证明只有几百字节），N=Non-interactive（一次提交即可验证），AK=Argument of Knowledge（证明你知道某信息）。Aleo 使用的是基于 snarkVM 的 zk-SNARK。",
  },
  {
    id: "blockchain",
    icon: "⛓️",
    name: "区块链验证",
    nameEn: "On-Chain Verification",
    desc: "证明上链后不可篡改且可公开验证",
    descEn: "Proofs on-chain are immutable and verifiable",
    unlockCondition: "获得第一场胜利",
    unlockKey: "firstWin",
    detail: "ZK 证明可以提交到区块链上。一旦上链，证明就不可篡改——任何人都能验证'这一发开火的结果是正确的'，但无法伪造历史。这就是为什么区块链游戏比传统游戏更公平。",
  },
  {
    id: "aleo",
    icon: "🅰️",
    name: "Aleo 网络",
    nameEn: "Aleo Network",
    desc: "专为隐私计算设计的区块链",
    descEn: "Blockchain designed for private computation",
    unlockCondition: "使用特殊武器",
    unlockKey: "weaponUsed",
    detail: "Aleo 是一条 Layer 1 区块链，专为零知识应用设计。它的 snarkVM 编译器把 Leo/Aleo Instructions 代码编译成 ZK 电路。本游戏的 verify_hit/verify_victory/verify_scan 都部署在 Aleo 测试网上。",
  },
];

/** 检查并解锁卡片 */
export function checkCardUnlock(unlockKey, gameState) {
  const unlocked = gameState.unlockedCards || [];
  const card = CONCEPT_CARDS.find(c => c.unlockKey === unlockKey && !unlocked.includes(c.id));
  return card || null;
}

// ===== 工具函数 =====

/** 渲染知识问答弹窗 HTML */
export function renderQuizPopup(quiz) {
  return `
    <div class="edu-overlay" id="edu-quiz-overlay">
      <div class="edu-card edu-quiz-card">
        <div class="edu-quiz-header">
          <span class="edu-quiz-icon">${quiz.icon}</span>
          <span class="edu-quiz-label">💡 知识问答</span>
          <button class="edu-skip" onclick="window.eduSkipQuiz()">跳过</button>
        </div>
        <div class="edu-quiz-question">${quiz.question}</div>
        <div class="edu-quiz-options">
          ${quiz.options.map((opt, i) => `
            <button class="edu-quiz-option" onclick="window.eduAnswerQuiz(${i})">
              <span class="edu-option-letter">${String.fromCharCode(65 + i)}</span>
              <span class="edu-option-text">${opt}</span>
            </button>
          `).join("")}
        </div>
        <div class="edu-quiz-reward">奖励：${quiz.reward}</div>
      </div>
    </div>`;
}

/** 渲染答题结果 */
export function renderQuizResult(quiz, selectedIndex) {
  const correct = selectedIndex === quiz.answer;
  return `
    <div class="edu-card edu-quiz-result">
      <div class="edu-result-icon">${correct ? "✅" : "❌"}</div>
      <div class="edu-result-title">${correct ? "回答正确！" : "答错了"}</div>
      <div class="edu-result-explanation">${quiz.explanation}</div>
      ${correct ? `<div class="edu-result-reward">🎁 ${quiz.reward}</div>` : '<div class="edu-result-try">没关系，下次继续努力！</div>'}
      <button class="edu-continue-btn" onclick="window.eduCloseQuiz()">继续游戏</button>
    </div>`;
}

/** 渲染概念卡片弹窗 */
export function renderCardPopup(card) {
  return `
    <div class="edu-overlay" id="edu-card-overlay">
      <div class="edu-card edu-concept-card">
        <div class="edu-card-header">
          <span class="edu-card-icon">${card.icon}</span>
          <span class="edu-card-label">🃏 概念卡片解锁</span>
        </div>
        <div class="edu-card-name">${card.name}</div>
        <div class="edu-card-name-en">${card.nameEn}</div>
        <div class="edu-card-desc">${card.desc}</div>
        <div class="edu-card-detail">${card.detail}</div>
        <button class="edu-continue-btn" onclick="window.eduCloseCard()">收到</button>
      </div>
    </div>`;
}

/** 渲染卡片收藏室 */
export function renderCardCollection(unlockedCards) {
  const cards = CONCEPT_CARDS.map(card => {
    const isUnlocked = unlockedCards.includes(card.id);
    return `
      <div class="edu-collection-card ${isUnlocked ? "is-unlocked" : "is-locked"}">
        <div class="edu-cc-icon">${isUnlocked ? card.icon : "🔒"}</div>
        <div class="edu-cc-name">${isUnlocked ? card.name : "???"}</div>
        <div class="edu-cc-desc">${isUnlocked ? card.desc : card.unlockCondition}</div>
      </div>`;
  }).join("");

  return `
    <div class="edu-collection">
      <h3>🃏 概念卡片收藏 (${unlockedCards.length}/${CONCEPT_CARDS.length})</h3>
      <div class="edu-collection-grid">${cards}</div>
    </div>`;
}

/** 渲染 ZK 实验室入口 */
export function renderZKLab() {
  return `
    <div class="edu-zk-lab">
      <h3>🔬 ZK 实验室</h3>
      <div class="edu-lab-grid">
        ${ZK_LAB_DEMOS.map(demo => `
          <div class="edu-lab-card" onclick="window.eduOpenLab('${demo.id}')">
            <span class="edu-lab-icon">${demo.icon}</span>
            <div class="edu-lab-title">${demo.title}</div>
            <div class="edu-lab-desc">${demo.desc}</div>
          </div>
        `).join("")}
      </div>
    </div>`;
}

/** 渲染位运算 AND 互动演示 */
export function renderBitwiseAndDemo() {
  return `
    <div class="edu-overlay" id="edu-lab-overlay">
      <div class="edu-card edu-lab-demo">
        <div class="edu-lab-demo-header">
          <h3>⚙️ 位运算 AND 演示</h3>
          <button class="edu-skip" onclick="window.eduCloseLab()">✕</button>
        </div>
        <div class="edu-lab-demo-body">
          <p>这是 verify_hit 的核心运算：<code>ships & mask</code></p>
          <div class="edu-bit-demo">
            <div class="edu-bit-row">
              <span class="edu-bit-label">船位 ships:</span>
              <div class="edu-bits" id="edu-ships-bits"></div>
            </div>
            <div class="edu-bit-row">
              <span class="edu-bit-label">射击 mask:</span>
              <div class="edu-bits" id="edu-mask-bits"></div>
            </div>
            <div class="edu-bit-row edu-result-row">
              <span class="edu-bit-label">AND 结果:</span>
              <div class="edu-bits" id="edu-result-bits"></div>
            </div>
          </div>
          <p class="edu-lab-hint">点击船位格和射击格切换 0/1，观察 AND 结果变化</p>
          <div class="edu-lab-conclusion" id="edu-lab-conclusion"></div>
        </div>
      </div>
    </div>`;
}
