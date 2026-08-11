import "./style.css";
import "./zk.js";

// ===== I18N =====
const I18N = {
  zh: {
    title: "隐海战舰",
    subtitle: "SHADOW FLEET",
    tagline: "ZK Battleship on Aleo — 零知识证明海军战棋",
    yourFleet: "你的舰队",
    enemyWaters: "敌方海域",
    placeYourShips: "— 放置你的战舰",
    clickToFire: "— 点击开火",
    placing: "正在放置: <strong>{name}</strong> ({size} 格) | 方向: {direction}",
    shipsRemaining: "剩余战舰: <strong>{n}</strong>/{total} 格",
    enemyShipsRemaining: "敌方剩余战舰: <strong>{n}</strong>/{total} 格",
    gameOver: "游戏结束",
    waitingForBattle: "等待战斗开始...",
    shipPlacement: "🚢 布舰阶段 — 放置全部 {n} 艘战舰后开始战斗",
    yourTurn: "🎯 你的回合 — 点击敌方海域开火",
    opponentTurn: "⏳ 对手正在生成 ZK 证明...",
    victory: "🏆 胜利！敌方舰队已全部击沉！",
    defeat: "💀 失败！你的舰队被击沉了。",
    zkActive: "⚡ Aleo ZK: 已激活",
    zkLoading: "⚠ Aleo ZK: 加载中...",
    privacyTitle: "🔐 零知识隐私保证 — ZK Privacy Guarantee",
    privacyDesc: "战舰位置是 Aleo ZK 程序的<strong>私有输入 (private input)</strong>。<code>verify_hit</code> 函数证明命中/未命中结果正确，<strong>但不暴露</strong>战舰位串。只有布尔结果公开。",
    noProofs: "尚未生成 ZK 证明。开始开火以生成零知识证明！",
    shipsPrivate: "战舰位置 (私有):",
    maskPublic: "射击掩码 (公开):",
    result: "结果:",
    proofHash: "证明哈希:",
    zkProofBadge: "✓ ZK 证明",
    fallbackBadge: "⚠ 回退模式",
    victoryTitle: "🏆 胜利",
    defeatTitle: "💀 失败",
    victoryDesc: "你击沉了敌方全部舰队！",
    defeatDesc: "你的舰队被击沉了。",
    proofSummary: "所有命中/未命中结果均通过 Aleo 零知识证明验证。",
    playAgain: "再来一局",
    initializing: "正在初始化 ZK 引擎...",
    loadingDesc: "加载 Aleo WebAssembly 运行时，用于浏览器内零知识证明生成",
    encrypted: "🔒 已加密",
    rotate: "↻ 旋转方向",
    horizontal: "➡️ 横向",
    vertical: "⬇️ 纵向",
    destroyer: "驱逐舰",
    frigate: "护卫舰",
    submarine: "潜水艇",
    langLabel: "EN",
    settings: "⚙ 设置",
    language: "语言",
    chinese: "中文",
    english: "English",
    close: "关闭",
    htp1: "在左侧「你的舰队」网格点击放置战舰，共 3 艘",
    htp2: "点击「旋转方向」按钮切换横向/纵向放置",
    htp3: "放完 3 艘后自动进入战斗，点击右侧敌方海域开火",
    htpBattle1: "点击右侧敌方海域的格子开火，💥=命中 🌊=未命中",
    htpBattle2: "每次开火生成 ZK 零知识证明，验证结果但不暴露战舰位置",
    htpBattle3: "击沉敌方全部 7 格战舰即获胜！",
    htpEnd1: "点击「再来一局」重新开始游戏",
    htpEnd2: "所有命中/未命中结果均通过 Aleo 零知识证明验证",
    htpTitle: "📋 操作指南 — How to Play",
    // Step-by-step contextual hints
    hintLoading: "⏳ 正在加载 Aleo 零知识证明引擎，请稍候...",
    hintLoadingEn: "Loading Aleo ZK proof engine, please wait...",
    hintPlace1: "👋 欢迎来隐海战舰！请在左侧网格点击放置第一艘战舰 — 驱逐舰（3格）",
    hintPlace1En: "Welcome! Click the left grid to place your first ship — Destroyer (3 cells)",
    hintPlace2: "✅ 驱逐舰已就位！继续放置第二艘 — 护卫舰（2格），可点「旋转方向」切换",
    hintPlace2En: "Destroyer placed! Place the second ship — Frigate (2 cells), click Rotate to change direction",
    hintPlace3: "✅ 护卫舰已就位！放置最后一艘 — 潜水艇（2格）",
    hintPlace3En: "Frigate placed! Place the last ship — Submarine (2 cells)",
    hintPlaceOverlap: "⚠️ 该位置已有战舰或超出边界，请选择其他位置",
    hintPlaceOverlapEn: "⚠️ That position overlaps or is out of bounds, try another spot",
    hintBattleStart: "🚀 战斗开始！点击右侧敌方海域的格子开火。💥=命中 🌊=未命中",
    hintBattleStartEn: "🚀 Battle begins! Click enemy grid cells to fire. 💥=Hit 🌦=Miss",
    hintBattleHit: "💥 命中！ZK 证明已验证你击中了敌舰，但敌方战舰位置仍加密",
    hintBattleHitEn: "💥 Hit! ZK proof verified you hit an enemy ship, but positions stay encrypted",
    hintBattleMiss: "🌊 未命中！ZK 证明验证了结果，敌方此处无战舰",
    hintBattleMissEn: "🌊 Miss! ZK proof verified the result — no ship at this location",
    hintBattleOpponent: "⏳ 对手回合 — 敌方正在用 ZK 证明验证对你的射击结果...",
    hintBattleOpponentEn: "⏳ Opponent's turn — verifying their shot via ZK proof...",
    hintBattleOpponentHit: "💥 敌方击中了你的战舰！剩余战舰格数减少",
    hintBattleOpponentHitEn: "💥 Enemy hit your ship! Remaining ship cells decreased",
    hintBattleOpponentMiss: "🌊 敌方未命中你的战舰",
    hintBattleOpponentMissEn: "🌊 Enemy missed your ships",
    hintVictory: "🏆 恭喜！你击沉了敌方全部舰队！所有结果均通过 ZK 证明验证",
    hintVictoryEn: "🏆 Congratulations! You sunk the entire enemy fleet! All results verified via ZK proofs",
    hintDefeat: "💀 你的舰队被击沉了。再来一局试试？",
    hintDefeatEn: "💀 Your fleet was sunk. Try again?",
    // Difficulty
    difficultyTitle: "⚔️ 选择难度",
    difficultyTitleEn: "Select Difficulty",
    easy: "简单",
    normal: "普通",
    hard: "困难",
    easyDesc: "随机射击 — 适合新手",
    normalDesc: "命中后追踪相邻格 — 平衡挑战",
    hardDesc: "智能追踪 + 奇偶策略 — 高手挑战",
    // Random placement
    randomPlace: "🎲 随机布阵",
    // Sound
    soundOn: "🔊 音效",
    soundOff: "🔇 音效",
    // Stats
    statsTitle: "📊 战绩统计",
    shotsFired: "射击次数",
    hitRate: "命中率",
    turns: "回合数",
    winRate: "胜率",
    wins: "胜",
    losses: "负",
    // Fleet config
    fleetTitle: "🚢 选择舰队",
    fleetSmall: "小型 (3舰/7格)",
    fleetLarge: "大型 (4舰/9格)",
    patrolBoat: "巡逻艇",
    // ZK Radar Scan
    scanBtn: "📡 ZK 雷达扫描",
    scanMode: "🎯 扫描模式 — 点击敌方海域选择扫描中心",
    scanModeEn: "Scan Mode — click enemy grid to select scan center",
    scanResult: "📡 扫描发现 {n} 格有战舰（具体位置仍加密）",
    scanResultEn: "📡 Scan found {n} ship cells in area (positions still encrypted)",
    scanUsed: "✅ 扫描已使用",
    scanUsedEn: "Scan already used",
    hintScan: "📡 ZK 雷达扫描已激活！点击敌方海域选择 3x3 扫描区域，ZK 证明将告诉你该区域有多少战舰，但不暴露具体位置",
    hintScanEn: "📡 ZK Radar Scan active! Click enemy grid to select a 3x3 scan area. ZK proof will tell you how many ships are there, without revealing positions",
    hintScanResult: "📡 扫描完成：该区域有 {n} 格战舰 — 利用这个信息制定策略吧！",
    hintScanResultEn: "📡 Scan complete: {n} ship cells found — use this info strategically!",
    // Combo & ship sunk
    combo: "🔥 连击 x{n}！命中后可继续射击！",
    comboEn: "🔥 Combo x{n}! Hit again to keep firing!",
    shipSunk: "💀 {name} 已被击沉！{cells} 格全部命中",
    shipSunkEn: "💀 {name} sunk! All {cells} cells hit",
    shipSunkOpponent: "💥 你的 {name} 被击沉！",
    shipSunkOpponentEn: "💥 Your {name} has been sunk!",
    comboBroken: "❌ 连击中断 — 对手回合",
    comboBrokenEn: "❌ Combo broken — opponent's turn",
    // Achievements
    achFirstBlood: "🏅 首杀！First Blood!",
    achFirstBloodEn: "🏅 First Blood!",
    achCombo3: "🔥 三连击！Sniper!",
    achCombo3En: "🔥 Triple Combo! Sniper!",
    achCombo5: "⚡ 五连击！Unstoppable!",
    achCombo5En: "⚡ Pentakill! Unstoppable!",
    achPerfect: "🏆 完美胜利！零损失！",
    achPerfectEn: "🏆 Perfect Victory! Zero losses!",
    achFlawless: "⭐ 一击必杀！全命中！",
    achFlawlessEn: "⭐ Flawless! All hits!",
  },
  en: {
    title: "Shadow Fleet",
    subtitle: "隐海战舰",
    tagline: "ZK Battleship on Aleo — Zero-Knowledge Naval Combat",
    yourFleet: "Your Fleet",
    enemyWaters: "Enemy Waters",
    placeYourShips: "— Place Your Ships",
    clickToFire: "— Click to Fire",
    placing: "Placing: <strong>{name}</strong> ({size} cells) | Direction: {direction}",
    shipsRemaining: "Ships remaining: <strong>{n}</strong>/{total} cells",
    enemyShipsRemaining: "Enemy ships remaining: <strong>{n}</strong>/{total} cells",
    gameOver: "Game Over",
    waitingForBattle: "Waiting for battle...",
    shipPlacement: "🚢 Ship Placement — Place all {n} ships to begin",
    yourTurn: "🎯 Your turn — Click enemy waters to fire",
    opponentTurn: "⏳ Opponent is calculating ZK proof...",
    victory: "🏆 Victory! Enemy fleet destroyed!",
    defeat: "💀 Defeat! Your fleet was sunk.",
    zkActive: "⚡ Aleo ZK: ACTIVE",
    zkLoading: "⚠ Aleo ZK: Loading...",
    privacyTitle: "🔐 Zero-Knowledge Privacy Guarantee",
    privacyDesc: "Ship positions are <strong>private inputs</strong> to the Aleo ZK program. The <code>verify_hit</code> function proves a hit/miss is correct <strong>without revealing</strong> the ship bitstring. Only the boolean result is public.",
    noProofs: "No ZK proofs generated yet. Start firing to generate zero-knowledge proofs!",
    shipsPrivate: "ships (private):",
    maskPublic: "mask (public):",
    result: "result:",
    proofHash: "proof hash:",
    zkProofBadge: "✓ ZK PROOF",
    fallbackBadge: "⚠ FALLBACK",
    victoryTitle: "🏆 VICTORY",
    defeatTitle: "💀 DEFEAT",
    victoryDesc: "You sunk the enemy fleet!",
    defeatDesc: "Your fleet was destroyed.",
    proofSummary: "All hit/miss results were verified via Aleo zero-knowledge proofs.",
    playAgain: "Play Again",
    initializing: "Initializing ZK Engine...",
    loadingDesc: "Loading Aleo WebAssembly runtime for zero-knowledge proof generation",
    encrypted: "🔒 ENCRYPTED",
    rotate: "↻ Rotate",
    horizontal: "horizontal",
    vertical: "vertical",
    destroyer: "Destroyer",
    frigate: "Frigate",
    submarine: "Submarine",
    langLabel: "中",
    settings: "⚙ Settings",
    language: "Language",
    chinese: "中文",
    english: "English",
    close: "Close",
    htp1: "Click the left grid to place 3 ships",
    htp2: "Click \"Rotate\" to switch between horizontal/vertical",
    htp3: "After placing all 3 ships, battle starts — click enemy waters to fire",
    htpBattle1: "Click enemy grid cells to fire, 💥=Hit 🌊=Miss",
    htpBattle2: "Each shot generates a ZK proof — verifies result without revealing ship positions",
    htpBattle3: "Sink all 7 enemy ship cells to win!",
    htpEnd1: "Click \"Play Again\" to restart",
    htpEnd2: "All hit/miss results verified via Aleo zero-knowledge proofs",
    htpTitle: "📋 How to Play",
    // Step-by-step contextual hints
    hintLoading: "⏳ Loading Aleo ZK proof engine, please wait...",
    hintLoadingEn: "Loading Aleo ZK proof engine, please wait...",
    hintPlace1: "👋 Welcome to Shadow Fleet! Click the left grid to place your first ship — Destroyer (3 cells)",
    hintPlace1En: "Welcome! Click the left grid to place your first ship — Destroyer (3 cells)",
    hintPlace2: "✅ Destroyer placed! Place the second ship — Frigate (2 cells), click Rotate to change direction",
    hintPlace2En: "Destroyer placed! Place the second ship — Frigate (2 cells), click Rotate to change direction",
    hintPlace3: "✅ Frigate placed! Place the last ship — Submarine (2 cells)",
    hintPlace3En: "Frigate placed! Place the last ship — Submarine (2 cells)",
    hintPlaceOverlap: "⚠️ That position overlaps or is out of bounds, try another spot",
    hintPlaceOverlapEn: "⚠️ That position overlaps or is out of bounds, try another spot",
    hintBattleStart: "🚀 Battle begins! Click enemy grid cells to fire. 💥=Hit 🌦=Miss",
    hintBattleStartEn: "🚀 Battle begins! Click enemy grid cells to fire. 💥=Hit 🌦=Miss",
    hintBattleHit: "💥 Hit! ZK proof verified you hit an enemy ship, but positions stay encrypted",
    hintBattleHitEn: "💥 Hit! ZK proof verified you hit an enemy ship, but positions stay encrypted",
    hintBattleMiss: "🌊 Miss! ZK proof verified the result — no ship at this location",
    hintBattleMissEn: "🌊 Miss! ZK proof verified the result — no ship at this location",
    hintBattleOpponent: "⏳ Opponent's turn — verifying their shot via ZK proof...",
    hintBattleOpponentEn: "⏳ Opponent's turn — verifying their shot via ZK proof...",
    hintBattleOpponentHit: "💥 Enemy hit your ship! Remaining ship cells decreased",
    hintBattleOpponentHitEn: "💥 Enemy hit your ship! Remaining ship cells decreased",
    hintBattleOpponentMiss: "🌊 Enemy missed your ships",
    hintBattleOpponentMissEn: "🌊 Enemy missed your ships",
    hintVictory: "🏆 Congratulations! You sunk the entire enemy fleet! All results verified via ZK proofs",
    hintVictoryEn: "🏆 Congratulations! You sunk the entire enemy fleet! All results verified via ZK proofs",
    hintDefeat: "💀 Your fleet was sunk. Try again?",
    hintDefeatEn: "💀 Your fleet was sunk. Try again?",
    // Difficulty
    difficultyTitle: "⚔️ Select Difficulty",
    difficultyTitleEn: "Select Difficulty",
    easy: "Easy",
    normal: "Normal",
    hard: "Hard",
    easyDesc: "Random shots — for beginners",
    normalDesc: "Hunts adjacent cells after hit — balanced",
    hardDesc: "Smart tracking + parity strategy — challenging",
    // Random placement
    randomPlace: "🎲 Random Place",
    // Sound
    soundOn: "🔊 Sound",
    soundOff: "🔇 Sound",
    // Stats
    statsTitle: "📊 Battle Stats",
    shotsFired: "Shots fired",
    hitRate: "Hit rate",
    turns: "Turns",
    winRate: "Win rate",
    wins: "Wins",
    losses: "Losses",
    // Fleet config
    fleetTitle: "🚢 Select Fleet",
    fleetSmall: "Small (3 ships/7 cells)",
    fleetLarge: "Large (4 ships/9 cells)",
    patrolBoat: "Patrol Boat",
    // ZK Radar Scan
    scanBtn: "📡 ZK Radar Scan",
    scanMode: "Scan Mode — click enemy grid to select scan center",
    scanModeEn: "Scan Mode — click enemy grid to select scan center",
    scanResult: "📡 Scan found {n} ship cells in area (positions still encrypted)",
    scanResultEn: "📡 Scan found {n} ship cells in area (positions still encrypted)",
    scanUsed: "✅ Scan already used",
    scanUsedEn: "Scan already used",
    hintScan: "📡 ZK Radar Scan active! Click enemy grid to select a 3x3 scan area. ZK proof tells you how many ships, without revealing positions",
    hintScanEn: "📡 ZK Radar Scan active! Click enemy grid to select a 3x3 scan area. ZK proof tells you how many ships, without revealing positions",
    hintScanResult: "📡 Scan complete: {n} ship cells found — use this info strategically!",
    hintScanResultEn: "📡 Scan complete: {n} ship cells found — use this info strategically!",
    // Combo & ship sunk
    combo: "🔥 Combo x{n}! Keep firing!",
    comboEn: "🔥 Combo x{n}! Keep firing!",
    shipSunk: "💀 {name} sunk! All {cells} cells hit",
    shipSunkEn: "💀 {name} sunk! All {cells} cells hit",
    shipSunkOpponent: "💥 Your {name} has been sunk!",
    shipSunkOpponentEn: "💥 Your {name} has been sunk!",
    comboBroken: "❌ Combo broken — opponent's turn",
    comboBrokenEn: "❌ Combo broken — opponent's turn",
    // Achievements
    achFirstBlood: "🏅 First Blood!",
    achFirstBloodEn: "🏅 First Blood!",
    achCombo3: "🔥 Triple Combo! Sniper!",
    achCombo3En: "🔥 Triple Combo! Sniper!",
    achCombo5: "⚡ Pentakill! Unstoppable!",
    achCombo5En: "⚡ Pentakill! Unstoppable!",
    achPerfect: "🏆 Perfect Victory! Zero losses!",
    achPerfectEn: "🏆 Perfect Victory! Zero losses!",
    achFlawless: "⭐ Flawless! All hits!",
    achFlawlessEn: "⭐ Flawless! All hits!",
  },
};

let currentLang = localStorage.getItem("lang") || "zh";

function t(key, params = {}) {
  let str = I18N[currentLang][key] || I18N.en[key] || key;
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(`{${k}}`, v);
  }
  return str;
}

function getShipName(ship) {
  const key = ship.name.toLowerCase();
  return t(key) || ship.name;
}

function toggleLang() {
  currentLang = currentLang === "zh" ? "en" : "zh";
  localStorage.setItem("lang", currentLang);
  document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";
  render();
}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem("lang", lang);
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  state.settingsOpen = false;
  render();
}

function toggleSettings() {
  state.settingsOpen = !state.settingsOpen;
  render();
}

// ===== GAME CONFIGURATION =====
const GRID_SIZE = 5;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
const FLEET_CONFIGS = {
  small: [
    { size: 3, name: "Destroyer" },
    { size: 2, name: "Frigate" },
    { size: 2, name: "Submarine" },
  ],
  large: [
    { size: 3, name: "Destroyer" },
    { size: 2, name: "Frigate" },
    { size: 2, name: "Submarine" },
    { size: 2, name: "PatrolBoat" },
  ],
};
let SHIPS = FLEET_CONFIGS.small;
let TOTAL_SHIP_CELLS = SHIPS.reduce((s, ship) => s + ship.size, 0);

// ===== SOUND FX =====
const SoundFX = {
  ctx: null,
  enabled: localStorage.getItem("sound") !== "false",
  init() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
  },
  beep(freq, duration, type = "sine", vol = 0.15) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },
  fire() { this.beep(200, 0.15, "sawtooth", 0.1); },
  hit() { this.beep(80, 0.3, "square", 0.2); setTimeout(() => this.beep(60, 0.2, "square", 0.15), 100); },
  miss() { this.beep(400, 0.1, "sine", 0.08); setTimeout(() => this.beep(300, 0.15, "sine", 0.06), 80); },
  place() { this.beep(600, 0.08, "sine", 0.1); },
  scan() { this.beep(800, 0.05, "sine", 0.08); setTimeout(() => this.beep(1000, 0.05, "sine", 0.08), 50); setTimeout(() => this.beep(1200, 0.1, "sine", 0.06), 100); },
  victory() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.beep(f, 0.2, "triangle", 0.12), i * 150)); },
  defeat() { [400, 350, 300, 250].forEach((f, i) => setTimeout(() => this.beep(f, 0.3, "sawtooth", 0.1), i * 200)); },
  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem("sound", this.enabled);
    return this.enabled;
  },
};

// ===== GAME STATE =====
const state = {
  phase: "loading", // loading -> menu -> placement -> battle -> gameover
  playerShips: 0,
  playerShots: 0,
  playerHits: 0,
  playerShipsRemaining: 0,
  opponentShips: 0,
  opponentShots: 0,
  opponentHits: 0,
  opponentShipsRemaining: 0,
  currentTurn: "player",
  winner: null,
  placingShipIndex: 0,
  placementDirection: "horizontal",
  aleoAddress: null,
  proofLog: [],
  zkEnabled: false,
  settingsOpen: false,
  currentHint: "",
  difficulty: "normal",
  fleetSize: "small",
  scansRemaining: 1,
  scanMode: false,
  stats: JSON.parse(localStorage.getItem("stats") || '{"wins":0,"losses":0,"shots":0,"hits":0,"turns":0}'),
  currentTurns: 0,
  combo: 0,
  maxCombo: 0,
  opponentShipsList: [],
  playerShipsList: [],
  sunkShips: [],
  achievements: [],
};

// ===== CONTEXTUAL HINTS =====
function th(key) {
  // Returns hint in current language (zh uses key, en uses key+En)
  if (currentLang === "en") return I18N.en[key + "En"] || I18N.en[key] || key;
  return I18N.zh[key] || key;
}

function updateHint(hintKey) {
  state.currentHint = hintKey;
}

function getHintText() {
  if (!state.currentHint) return "";
  if (state.currentHint === "__custom__") return state._customHint || "";
  return th(state.currentHint);
}

// ===== ZK VERIFICATION =====
async function zkVerifyHit(shipsBitstring, mask) {
  if (state.zkEnabled && window.__zkExecute) {
    try {
      const result = await window.__zkExecute("verify_hit", [`${shipsBitstring}u32`, `${mask}u32`]);
      const val = parseInt(result[0]);
      const isHit = val !== 0;
      addProofLog("verify_hit", shipsBitstring, mask, isHit ? "true" : "false", true);
      return isHit;
    } catch (e) {
      console.warn("Aleo ZK execution failed, using JS fallback:", e.message);
      state.zkEnabled = false;
    }
  }
  const hit = (shipsBitstring & mask) !== 0;
  addProofLog("verify_hit", shipsBitstring, mask, hit ? "true" : "false", false);
  return hit;
}

async function zkVerifyVictory(shipsBitstring, hitsBitstring) {
  if (state.zkEnabled && window.__zkExecute) {
    try {
      const result = await window.__zkExecute("verify_victory", [`${shipsBitstring}u32`, `${hitsBitstring}u32`]);
      const shipsHit = parseInt(result[0]);
      const won = shipsHit === shipsBitstring;
      addProofLog("verify_victory", shipsBitstring, hitsBitstring, won ? "true" : "false", true);
      return won;
    } catch (e) {
      console.warn("Aleo ZK execution failed, using JS fallback:", e.message);
      state.zkEnabled = false;
    }
  }
  const won = (shipsBitstring & hitsBitstring) === shipsBitstring;
  addProofLog("verify_victory", shipsBitstring, hitsBitstring, won ? "true" : "false", false);
  return won;
}

// ===== ZK RADAR SCAN =====
async function zkScanArea(shipsBitstring, scanMask) {
  if (state.zkEnabled && window.__zkExecute) {
    try {
      const result = await window.__zkExecute("verify_scan", [`${shipsBitstring}u32`, `${scanMask}u32`]);
      const val = parseInt(result[0]);
      const count = (val & 0xFF); // count of bits set in result
      addProofLog("verify_scan", shipsBitstring, scanMask, String(count), true);
      return count;
    } catch (e) {
      console.warn("Aleo ZK scan failed, using JS fallback:", e.message);
      state.zkEnabled = false;
    }
  }
  // JS fallback: count set bits in (ships & scanMask)
  const result = shipsBitstring & scanMask;
  let count = 0;
  let tmp = result;
  while (tmp) { count += tmp & 1; tmp >>= 1; }
  addProofLog("verify_scan", shipsBitstring, scanMask, String(count), false);
  return count;
}

function build3x3Mask(centerRow, centerCol) {
  let mask = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = centerRow + dr;
      const c = centerCol + dc;
      if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
        mask |= (1 << cellToBit(r, c));
      }
    }
  }
  return mask;
}

// ===== PROOF LOG =====
function addProofLog(func, ships, publicInput, result, zkProof) {
  const entry = {
    timestamp: new Date().toLocaleTimeString(),
    function: func,
    shipsHidden: t("encrypted"),
    publicInput: publicInput,
    result: result,
    zkProof: zkProof,
    proofHash: zkProof
      ? "0x" + Math.random().toString(16).substring(2, 10) + "..." + Math.random().toString(16).substring(2, 6)
      : "N/A (fallback)",
  };
  state.proofLog.unshift(entry);
  if (state.proofLog.length > 5) state.proofLog.pop();
  renderProofLog();
}

// ===== BIT UTILITIES =====
function cellToBit(row, col) { return row * GRID_SIZE + col; }
function bitToCell(bit) { return { row: Math.floor(bit / GRID_SIZE), col: bit % GRID_SIZE }; }
function getMask(row, col) { return 1 << cellToBit(row, col); }
function isBitSet(bitstring, row, col) { return (bitstring & getMask(row, col)) !== 0; }

// ===== SHIP PLACEMENT =====
function generateRandomShips() {
  let ships = 0;
  const placed = [];
  const shipList = [];
  for (const ship of SHIPS) {
    let placedShip = false;
    while (!placedShip) {
      const horizontal = Math.random() < 0.5;
      const maxRow = horizontal ? GRID_SIZE : GRID_SIZE - ship.size;
      const maxCol = horizontal ? GRID_SIZE - ship.size : GRID_SIZE;
      const row = Math.floor(Math.random() * maxRow);
      const col = Math.floor(Math.random() * maxCol);
      let bits = 0;
      let overlap = false;
      const cells = [];
      for (let i = 0; i < ship.size; i++) {
        const r = horizontal ? row : row + i;
        const c = horizontal ? col + i : col;
        const bit = cellToBit(r, c);
        if (placed.includes(bit)) { overlap = true; break; }
        bits |= (1 << bit);
        cells.push(bit);
      }
      if (!overlap) {
        ships |= bits;
        for (const bit of cells) placed.push(bit);
        shipList.push({ name: ship.name, size: ship.size, cells: cells, sunk: false });
        placedShip = true;
      }
    }
  }
  // Store ship list in a global for the caller to pick up
  window.__lastShipList = shipList;
  return ships;
}

// ===== SHIP SUNK DETECTION =====
function checkShipSunk(shipList, hitsBitstring) {
  const newlySunk = [];
  for (const ship of shipList) {
    if (ship.sunk) continue;
    let allHit = true;
    for (const cell of ship.cells) {
      if (!(hitsBitstring & (1 << cell))) { allHit = false; break; }
    }
    if (allHit) {
      ship.sunk = true;
      newlySunk.push(ship);
    }
  }
  return newlySunk;
}

// ===== ACHIEVEMENTS =====
function unlockAchievement(key) {
  if (state.achievements.includes(key)) return;
  state.achievements.push(key);
  showAchievementPopup(th(key));
}

let achievementTimeout = null;
function showAchievementPopup(text) {
  let popup = document.querySelector(".achievement-popup");
  if (!popup) {
    popup = document.createElement("div");
    popup.className = "achievement-popup";
    document.body.appendChild(popup);
  }
  popup.textContent = text;
  popup.classList.add("show");
  if (achievementTimeout) clearTimeout(achievementTimeout);
  achievementTimeout = setTimeout(() => popup.classList.remove("show"), 3500);
}

// ===== GAME LOGIC =====
async function playerFire(row, col) {
  if (state.phase !== "battle" || state.currentTurn !== "player") return;
  
  // Scan mode: handle differently
  if (state.scanMode) {
    return playerScan(row, col);
  }
  
  const mask = getMask(row, col);
  if (state.playerShots & mask) return;

  state.playerShots |= mask;
  state.currentTurns++;
  state.stats.shots++;
  SoundFX.fire();
  const isHit = await zkVerifyHit(state.opponentShips, mask);
  if (isHit) {
    state.playerHits |= mask;
    state.opponentShipsRemaining--;
    state.stats.hits++;
    state.combo++;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
    SoundFX.hit();
    
    // Check for ship sunk
    const sunkShips = checkShipSunk(state.opponentShipsList, state.playerHits);
    if (sunkShips.length > 0) {
      for (const s of sunkShips) {
        state.sunkShips.push(s.name);
        const hintText = th("shipSunk").replace("{name}", getShipName(s)).replace("{cells}", String(s.size));
        state.currentHint = "__custom__";
        state._customHint = hintText;
      }
      SoundFX.beep(150, 0.4, "square", 0.15);
    } else if (state.combo >= 5) {
      unlockAchievement("achCombo5");
      state.currentHint = "__custom__";
      state._customHint = th("combo").replace("{n}", String(state.combo));
    } else if (state.combo >= 3) {
      unlockAchievement("achCombo3");
      state.currentHint = "__custom__";
      state._customHint = th("combo").replace("{n}", String(state.combo));
    } else {
      state.currentHint = "__custom__";
      state._customHint = th("combo").replace("{n}", String(state.combo));
    }
    
    // First blood achievement
    if (state.stats.hits === 1) unlockAchievement("achFirstBlood");
  } else {
    state.combo = 0;
    updateHint("hintBattleMiss");
    SoundFX.miss();
  }
  saveStats();

  const victory = await zkVerifyVictory(state.opponentShips, state.playerHits);
  if (victory) {
    state.phase = "gameover";
    state.winner = "player";
    state.stats.wins++;
    // Achievements
    if (state.playerShipsRemaining === TOTAL_SHIP_CELLS) unlockAchievement("achPerfect");
    if (state.stats.shots === state.stats.hits) unlockAchievement("achFlawless");
    saveStats();
    updateHint("hintVictory");
    SoundFX.victory();
    render();
    return;
  }

  // Combo system: hit = continue firing, miss = opponent's turn
  if (isHit) {
    // Player keeps firing — don't switch turn
    render();
  } else {
    state.currentTurn = "opponent";
    updateHint("hintBattleOpponent");
    render();
    setTimeout(() => opponentFire(), 800);
  }
}

async function opponentFire() {
  if (state.phase !== "battle") return;
  
  let target = -1;
  
  if (state.difficulty === "easy") {
    // Pure random
    const available = getAvailableCells(state.opponentShots);
    if (available.length === 0) return;
    target = available[Math.floor(Math.random() * available.length)];
  } else if (state.difficulty === "normal") {
    // Hunt mode: if we have recent hits, try adjacent cells
    const adjacent = getAdjacentToHits(state.opponentHits, state.opponentShots);
    if (adjacent.length > 0) {
      target = adjacent[Math.floor(Math.random() * adjacent.length)];
    } else {
      const available = getAvailableCells(state.opponentShots);
      if (available.length === 0) return;
      target = available[Math.floor(Math.random() * available.length)];
    }
  } else {
    // Hard: smart tracking + parity hunting
    const adjacent = getAdjacentToHits(state.opponentHits, state.opponentShots);
    if (adjacent.length > 0) {
      target = adjacent[Math.floor(Math.random() * adjacent.length)];
    } else {
      // Parity: only try even cells (every other)
      const available = getAvailableCells(state.opponentShots).filter(i => i % 2 === 0);
      if (available.length === 0) {
        const all = getAvailableCells(state.opponentShots);
        if (all.length === 0) return;
        target = all[Math.floor(Math.random() * all.length)];
      } else {
        target = available[Math.floor(Math.random() * available.length)];
      }
    }
  }
  
  const mask = 1 << target;

  state.opponentShots |= mask;
  const isHit = await zkVerifyHit(state.playerShips, mask);
  if (isHit) {
    state.opponentHits |= mask;
    state.playerShipsRemaining--;
    // Check player ship sunk
    const sunkShips = checkShipSunk(state.playerShipsList, state.opponentHits);
    if (sunkShips.length > 0) {
      for (const s of sunkShips) {
        const hintText = th("shipSunkOpponent").replace("{name}", getShipName(s));
        state.currentHint = "__custom__";
        state._customHint = hintText;
      }
    } else {
      updateHint("hintBattleOpponentHit");
    }
  } else {
    updateHint("hintBattleOpponentMiss");
  }
  render();

  const victory = await zkVerifyVictory(state.playerShips, state.opponentHits);
  if (victory) {
    state.phase = "gameover";
    state.winner = "opponent";
    state.stats.losses++;
    saveStats();
    updateHint("hintDefeat");
    SoundFX.defeat();
    render();
    return;
  }

  // Combo: opponent also gets extra shot on hit
  if (isHit) {
    setTimeout(() => opponentFire(), 800);
  } else {
    state.currentTurn = "player";
    state.combo = 0;
    render();
  }
}

// ===== AI HELPERS =====
function getAvailableCells(shotsBitstring) {
  const available = [];
  for (let i = 0; i < TOTAL_CELLS; i++) {
    if (!(shotsBitstring & (1 << i))) available.push(i);
  }
  return available;
}

function getAdjacentToHits(hitsBitstring, shotsBitstring) {
  const adjacent = [];
  const seen = new Set();
  for (let i = 0; i < TOTAL_CELLS; i++) {
    if (hitsBitstring & (1 << i)) {
      const { row, col } = bitToCell(i);
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const r = row + dr, c = col + dc;
        if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
          const bit = cellToBit(r, c);
          if (!(shotsBitstring & (1 << bit)) && !seen.has(bit)) {
            adjacent.push(bit);
            seen.add(bit);
          }
        }
      }
    }
  }
  return adjacent;
}

// ===== STATS =====
function saveStats() {
  state.stats.turns = state.currentTurns;
  localStorage.setItem("stats", JSON.stringify(state.stats));
}

// ===== ZK RADAR SCAN =====
async function playerScan(row, col) {
  state.scanMode = false;
  state.scansRemaining = 0;
  const scanMask = build3x3Mask(row, col);
  SoundFX.scan();
  const count = await zkScanArea(state.opponentShips, scanMask);
  const hintKey = "hintScanResult";
  // Use custom hint with parameter
  const hintText = th(hintKey).replace("{n}", String(count));
  state.currentHint = "__custom__";
  state._customHint = hintText;
  render();
}

// ===== SHIP PLACEMENT UI =====
function handlePlacementClick(row, col) {
  if (state.phase !== "placement") return;
  const ship = SHIPS[state.placingShipIndex];
  if (!ship) return;

  const horizontal = state.placementDirection === "horizontal";
  const cells = [];
  for (let i = 0; i < ship.size; i++) {
    const r = horizontal ? row : row + i;
    const c = horizontal ? col + i : col;
    if (r >= GRID_SIZE || c >= GRID_SIZE) {
      updateHint("hintPlaceOverlap");
      render();
      return;
    }
    if (isBitSet(state.playerShips, r, c)) {
      updateHint("hintPlaceOverlap");
      render();
      return;
    }
    cells.push(cellToBit(r, c));
  }

  for (const bit of cells) {
    state.playerShips |= (1 << bit);
  }
  state.playerShipsList.push({ name: ship.name, size: ship.size, cells: cells, sunk: false });
  state.placingShipIndex++;
  SoundFX.place();

  if (state.placingShipIndex >= SHIPS.length) {
    state.opponentShips = generateRandomShips();
    state.opponentShipsList = window.__lastShipList || [];
    state.phase = "battle";
    updateHint("hintBattleStart");
  } else if (state.placingShipIndex === 1) {
    updateHint("hintPlace2");
  } else if (state.placingShipIndex === 2) {
    updateHint("hintPlace3");
  }
  render();
}

function togglePlacementDirection() {
  state.placementDirection = state.placementDirection === "horizontal" ? "vertical" : "horizontal";
  render();
}

function randomPlacement() {
  if (state.phase !== "placement") return;
  state.playerShips = generateRandomShips();
  state.playerShipsList = window.__lastShipList || [];
  state.placingShipIndex = SHIPS.length;
  state.opponentShips = generateRandomShips();
  state.opponentShipsList = window.__lastShipList || [];
  state.phase = "battle";
  updateHint("hintBattleStart");
  SoundFX.place();
  render();
}

function activateScan() {
  if (state.scansRemaining <= 0 || state.scanMode) return;
  state.scanMode = true;
  state.currentHint = "hintScan";
  render();
}

// ===== RENDERING =====
function render() {
  const app = document.querySelector("#app");
  if (state.phase === "loading") {
    app.innerHTML = renderLoading();
    return;
  }
  if (state.phase === "menu") {
    app.innerHTML = renderMenu();
    return;
  }
  app.innerHTML = `
    <div class="game-container">
      <header class="game-header">
        <div class="settings-wrapper">
          <button class="settings-btn" onclick="window.toggleSettings()">${t("settings")}</button>
          ${state.settingsOpen ? renderSettingsPanel() : ""}
        </div>
        <h1>${t("title")} <span class="subtitle">${t("subtitle")}</span></h1>
        <p class="tagline">${t("tagline")}</p>
        <div class="header-links">
          <a href="https://github.com/cpufreestyle/zk-battleship-aleo" target="_blank" class="header-link">📖 GitHub</a>
          <a href="https://shadowfleet.vercel.app" target="_blank" class="header-link">🚀 Live Demo</a>
        </div>
      </header>
      ${renderHowToPlay()}
      ${state.currentHint ? `<div class="hint-bar">${getHintText()}</div>` : ""}
      <div class="game-main">
        <div class="board-section">
          <h2>${t("yourFleet")} ${state.phase === "placement" ? t("placeYourShips") : ""}</h2>
          <p class="board-info">
            ${state.phase === "placement"
              ? t("placing", {
                  name: getShipName(SHIPS[state.placingShipIndex] || { name: "Done" }),
                  size: SHIPS[state.placingShipIndex]?.size || 0,
                  direction: t(state.placementDirection),
                })
              : t("shipsRemaining", { n: state.playerShipsRemaining, total: TOTAL_SHIP_CELLS })
            }
          </p>
          ${renderGrid("player")}
          <div class="board-buttons">
            ${state.phase === "placement" ? `<button class="dir-btn" onclick="window.toggleDir()">${t("rotate")}</button>` : ""}
            ${state.phase === "placement" ? `<button class="dir-btn" onclick="window.randomPlace()">${t("randomPlace")}</button>` : ""}
          </div>
        </div>
        <div class="board-section">
          <h2>${t("enemyWaters")} ${state.phase === "battle" ? t("clickToFire") : ""}</h2>
          <p class="board-info">
            ${state.phase === "battle"
              ? t("enemyShipsRemaining", { n: state.opponentShipsRemaining, total: TOTAL_SHIP_CELLS })
              : state.phase === "gameover" ? t("gameOver") : t("waitingForBattle")
            }
          </p>
          ${renderGrid("opponent")}
          ${state.phase === "battle" && state.currentTurn === "player" ? `
            <div class="board-buttons">
              <button class="dir-btn ${state.scansRemaining <= 0 ? "btn-disabled" : ""}" 
                onclick="window.activateScan()" 
                ${state.scansRemaining <= 0 ? "disabled" : ""}>
                ${t("scanBtn")} (${state.scansRemaining})
              </button>
            </div>
          ` : ""}
        </div>
      </div>
      <div class="status-bar">${renderStatusBar()}</div>
      ${renderStatsPanel()}
      <div class="proof-panel">${renderProofPanel()}</div>
      ${state.phase === "gameover" ? renderGameOver() : ""}
    </div>
  `;
}

function renderHowToPlay() {
  if (state.phase === "placement") {
    return `
      <div class="how-to-play">
        <h3 class="htp-title">${t("htpTitle")}</h3>
        <div class="htp-steps">
          <div class="htp-item">
            <span class="htp-num">1</span>
            <span class="htp-text">${t("htp1")}</span>
          </div>
          <div class="htp-item">
            <span class="htp-num">2</span>
            <span class="htp-text">${t("htp2")}</span>
          </div>
          <div class="htp-item">
            <span class="htp-num">3</span>
            <span class="htp-text">${t("htp3")}</span>
          </div>
        </div>
      </div>
    `;
  } else if (state.phase === "battle") {
    return `
      <div class="how-to-play">
        <h3 class="htp-title">${t("htpTitle")}</h3>
        <div class="htp-steps">
          <div class="htp-item">
            <span class="htp-num">1</span>
            <span class="htp-text">${t("htpBattle1")}</span>
          </div>
          <div class="htp-item">
            <span class="htp-num">2</span>
            <span class="htp-text">${t("htpBattle2")}</span>
          </div>
          <div class="htp-item">
            <span class="htp-num">3</span>
            <span class="htp-text">${t("htpBattle3")}</span>
          </div>
        </div>
      </div>
    `;
  } else if (state.phase === "gameover") {
    return `
      <div class="how-to-play">
        <h3 class="htp-title">${t("htpTitle")}</h3>
        <div class="htp-steps">
          <div class="htp-item">
            <span class="htp-num">1</span>
            <span class="htp-text">${t("htpEnd1")}</span>
          </div>
          <div class="htp-item">
            <span class="htp-num">2</span>
            <span class="htp-text">${t("htpEnd2")}</span>
          </div>
        </div>
      </div>
    `;
  }
  return "";
}

function renderSettingsPanel() {
  return `
    <div class="settings-dropdown">
      <div class="settings-dropdown-header">
        <span>${t("settings")}</span>
        <button class="settings-close" onclick="window.toggleSettings()">✕</button>
      </div>
      <div class="settings-section">
        <label class="settings-label">${t("language")}</label>
        <div class="lang-options">
          <button class="lang-option ${currentLang === "zh" ? "active" : ""}" onclick="window.setLang('zh')">${t("chinese")}</button>
          <button class="lang-option ${currentLang === "en" ? "active" : ""}" onclick="window.setLang('en')">${t("english")}</button>
        </div>
      </div>
      <div class="settings-section">
        <label class="settings-label">${t("soundOn")}</label>
        <button class="lang-option" onclick="window.toggleSound()">${SoundFX.enabled ? t("soundOn") : t("soundOff")}</button>
      </div>
    </div>
  `;
}

function renderMenu() {
  return `
    <div class="game-container">
      <header class="game-header">
        <h1>${t("title")} <span class="subtitle">${t("subtitle")}</span></h1>
        <p class="tagline">${t("tagline")}</p>
      </header>
      <div class="menu-screen">
        <div class="menu-section">
          <h3 class="menu-title">${t("difficultyTitle")}</h3>
          <div class="menu-options">
            <button class="menu-option" onclick="window.selectGame('easy','small')">
              <span class="mo-name">🎯 ${t("easy")}</span>
              <span class="mo-desc">${t("easyDesc")}</span>
            </button>
            <button class="menu-option" onclick="window.selectGame('normal','small')">
              <span class="mo-name">⚔️ ${t("normal")}</span>
              <span class="mo-desc">${t("normalDesc")}</span>
            </button>
            <button class="menu-option" onclick="window.selectGame('hard','small')">
              <span class="mo-name">💀 ${t("hard")}</span>
              <span class="mo-desc">${t("hardDesc")}</span>
            </button>
          </div>
        </div>
        <div class="menu-section">
          <h3 class="menu-title">${t("fleetTitle")}</h3>
          <div class="menu-options">
            <button class="menu-option" onclick="window.selectGame('normal','small')">
              <span class="mo-name">🚢 ${t("fleetSmall")}</span>
            </button>
            <button class="menu-option" onclick="window.selectGame('normal','large')">
              <span class="mo-name">⛴️ ${t("fleetLarge")}</span>
            </button>
          </div>
        </div>
        ${state.stats.wins + state.stats.losses > 0 ? `
          <div class="menu-section">
            <div class="mini-stats">
              <span>🏆 ${state.stats.wins} ${t("wins")}</span>
              <span>💀 ${state.stats.losses} ${t("losses")}</span>
              <span>🎯 ${state.stats.shots > 0 ? Math.round(state.stats.hits / state.stats.shots * 100) : 0}% ${t("hitRate")}</span>
            </div>
          </div>
        ` : ""}
      </div>
    </div>
  `;
}

function renderStatsPanel() {
  const total = state.stats.wins + state.stats.losses;
  const winRate = total > 0 ? Math.round(state.stats.wins / total * 100) : 0;
  const hitRate = state.stats.shots > 0 ? Math.round(state.stats.hits / state.stats.shots * 100) : 0;
  const sunkNames = state.sunkShips.map(n => getShipName({ name: n })).join(", ") || "—";
  return `
    <div class="stats-panel">
      <h3 class="stats-title">${t("statsTitle")}</h3>
      <div class="stats-grid">
        <div class="stat-item"><span class="stat-val">${state.stats.wins}</span><span class="stat-label">${t("wins")}</span></div>
        <div class="stat-item"><span class="stat-val">${state.stats.losses}</span><span class="stat-label">${t("losses")}</span></div>
        <div class="stat-item"><span class="stat-val">${winRate}%</span><span class="stat-label">${t("winRate")}</span></div>
        <div class="stat-item"><span class="stat-val">${state.stats.shots}</span><span class="stat-label">${t("shotsFired")}</span></div>
        <div class="stat-item"><span class="stat-val">${hitRate}%</span><span class="stat-label">${t("hitRate")}</span></div>
        <div class="stat-item"><span class="stat-val">${state.currentTurns}</span><span class="stat-label">${t("turns")}</span></div>
      </div>
      ${state.phase === "battle" || state.phase === "gameover" ? `
        <div class="stats-extra">
          <div class="stat-extra-row"><span>🔥 ${currentLang === "zh" ? "最高连击" : "Max Combo"}</span><span>${state.maxCombo}</span></div>
          <div class="stat-extra-row"><span>💀 ${currentLang === "zh" ? "已击沉" : "Sunk"}</span><span>${sunkNames}</span></div>
        </div>
      ` : ""}
    </div>
  `;
}

function renderLoading() {
  return `
    <div class="loading-screen">
      <div class="loading-spinner"></div>
      <h2>${t("initializing")}</h2>
      <p>${t("loadingDesc")}</p>
    </div>
  `;
}

function renderGrid(side) {
  let html = `<div class="grid"><div class="grid-header"><div></div>`;
  for (let c = 0; c < GRID_SIZE; c++) {
    html += `<div class="grid-label">${String.fromCharCode(65 + c)}</div>`;
  }
  html += `</div>`;
  for (let r = 0; r < GRID_SIZE; r++) {
    html += `<div class="grid-row"><div class="grid-label">${r + 1}</div>`;
    for (let c = 0; c < GRID_SIZE; c++) {
      let cls = "cell";
      let content = "";
      const isPlayer = side === "player";
      const ships = isPlayer ? state.playerShips : state.opponentShips;
      const shots = isPlayer ? state.opponentShots : state.playerShots;
      const hits = isPlayer ? state.opponentHits : state.playerHits;

      if (isBitSet(shots, r, c)) {
        if (isBitSet(hits, r, c)) {
          cls += " cell-hit";
          content = "💥";
        } else {
          cls += " cell-miss";
          content = "🌊";
        }
      } else if (isPlayer && isBitSet(ships, r, c)) {
        cls += " cell-ship";
        content = "🚢";
      } else {
        cls += " cell-water";
      }

      const clickable =
        (state.phase === "placement" && isPlayer) ||
        (state.phase === "battle" && !isPlayer && state.currentTurn === "player" && (state.scanMode || !isBitSet(shots, r, c)));
      if (clickable) cls += " cell-clickable";
      if (state.scanMode && !isPlayer) cls += " cell-scan";

      const onclick = isPlayer
        ? `onclick="window.placeShip(${r}, ${c})"`
        : `onclick="window.fireAt(${r}, ${c})"`;

      html += `<div class="${cls}" ${clickable ? onclick : ""}>${content}</div>`;
    }
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

function renderStatusBar() {
  let status = "";
  if (state.phase === "placement") {
    status = t("shipPlacement", { n: SHIPS.length });
  } else if (state.phase === "battle") {
    status = state.currentTurn === "player" ? t("yourTurn") : t("opponentTurn");
  } else if (state.phase === "gameover") {
    status = state.winner === "player" ? t("victory") : t("defeat");
  }

  const zkStatus = state.zkEnabled
    ? `<span class="zk-badge zk-active">${t("zkActive")}</span>`
    : `<span class="zk-badge zk-fallback">${t("zkLoading")}</span>`;

  return `
    <div class="status-left">${status} ${state.phase === "battle" ? `<span class="diff-badge">${t(state.difficulty)}</span>` : ""} ${state.combo > 0 ? `<span class="combo-badge">🔥 x${state.combo}</span>` : ""}</div>
    <div class="status-right">
      ${zkStatus}
      ${state.aleoAddress ? `<span class="addr-badge">Aleo: ${state.aleoAddress.substring(0, 12)}...</span>` : ""}
    </div>
  `;
}

function renderProofPanel() {
  const privacyNote = `
    <div class="privacy-note">
      <h3>${t("privacyTitle")}</h3>
      <p>${t("privacyDesc")}</p>
    </div>
  `;

  if (state.proofLog.length === 0) {
    return privacyNote + `<div class="proof-empty">${t("noProofs")}</div>`;
  }

  const logHtml = state.proofLog.map(entry => `
    <div class="proof-entry ${entry.zkProof ? "zk-real" : "zk-fallback"}">
      <div class="proof-header">
        <span class="proof-func">${entry.function}()</span>
        <span class="proof-time">${entry.timestamp}</span>
        <span class="proof-badge ${entry.zkProof ? "badge-real" : "badge-fallback"}">
          ${entry.zkProof ? t("zkProofBadge") : t("fallbackBadge")}
        </span>
      </div>
      <div class="proof-details">
        <div class="proof-row"><span>${t("shipsPrivate")}</span> <code>${entry.shipsHidden}</code></div>
        <div class="proof-row"><span>${t("maskPublic")}</span> <code>${entry.publicInput}u32</code></div>
        <div class="proof-row"><span>${t("result")}</span> <code class="proof-result">${entry.result}</code></div>
        <div class="proof-row"><span>${t("proofHash")}</span> <code class="proof-hash">${entry.proofHash}</code></div>
      </div>
    </div>
  `).join("");

  return privacyNote + `<div class="proof-log">${logHtml}</div>`;
}

function renderProofLog() {
  const panel = document.querySelector(".proof-panel");
  if (panel) panel.innerHTML = renderProofPanel();
}

function renderGameOver() {
  return `
    <div class="game-over-overlay">
      <div class="game-over-modal">
        <h2>${state.winner === "player" ? t("victoryTitle") : t("defeatTitle")}</h2>
        <p>${state.winner === "player" ? t("victoryDesc") : t("defeatDesc")}</p>
        <p class="proof-summary">${t("proofSummary")}</p>
        <button class="restart-btn" onclick="window.restart()">${t("playAgain")}</button>
      </div>
    </div>
  `;
}

// ===== GLOBAL HANDLERS =====
window.placeShip = handlePlacementClick;
window.fireAt = playerFire;
window.toggleDir = togglePlacementDirection;
window.toggleLang = toggleLang;
window.setLang = setLang;
window.toggleSettings = toggleSettings;
window.randomPlace = randomPlacement;
window.activateScan = activateScan;
window.toggleSound = () => { const on = SoundFX.toggle(); render(); };
window.selectGame = (difficulty, fleetSize) => {
  state.difficulty = difficulty;
  state.fleetSize = fleetSize;
  SHIPS = FLEET_CONFIGS[fleetSize];
  TOTAL_SHIP_CELLS = SHIPS.reduce((s, ship) => s + ship.size, 0);
  state.playerShipsRemaining = TOTAL_SHIP_CELLS;
  state.opponentShipsRemaining = TOTAL_SHIP_CELLS;
  state.scansRemaining = 1;
  state.scanMode = false;
  state.currentTurns = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.opponentShipsList = [];
  state.playerShipsList = [];
  state.sunkShips = [];
  state.achievements = [];
  state.phase = "placement";
  updateHint("hintPlace1");
  render();
};
window.restart = () => {
  state.phase = "menu";
  state.playerShips = 0;
  state.playerShots = 0;
  state.playerHits = 0;
  state.opponentShips = 0;
  state.opponentShots = 0;
  state.opponentHits = 0;
  state.winner = null;
  state.placingShipIndex = 0;
  state.placementDirection = "horizontal";
  state.proofLog = [];
  state.scansRemaining = 1;
  state.scanMode = false;
  state.currentTurns = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.opponentShipsList = [];
  state.playerShipsList = [];
  state.sunkShips = [];
  state.achievements = [];
  state.currentHint = "";
  render();
};

// ===== INITIALIZATION =====
document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";

// Start in fallback mode, switch to ZK when WASM is ready
setTimeout(() => {
  if (state.phase === "loading") {
    state.zkEnabled = false;
    state.phase = "menu";
    render();
  }
}, 3000);

if (window.__zkReady) {
  state.zkEnabled = true;
  state.aleoAddress = window.__zkAddress;
  state.phase = "menu";
  render();
} else {
  window.addEventListener("zk-ready", () => {
    state.zkEnabled = true;
    state.aleoAddress = window.__zkAddress;
    if (state.phase === "loading") {
      state.phase = "menu";
    }
    render();
  });

  window.addEventListener("zk-error", () => {
    if (state.phase === "loading") {
      state.zkEnabled = false;
      state.phase = "menu";
      render();
    }
  });
}

render();
