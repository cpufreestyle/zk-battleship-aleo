import "./style.css";
import "./zk.js";
import { sfx } from "./audio.js";
import * as fx from "./fx.js";
import { ZKGPU } from "./gpu.js";
import { generateAIPanel, callTool } from "./mcp.js";
import { syncState } from "./state-mcp.js";

// ===== GAME CONFIGURATION =====
const GRID_SIZE = 5;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

// Fleet configurations: standard (3 ships) and extended (4 ships)
const FLEET_CONFIGS = {
  standard: [
    { size: 3, name: "Destroyer", cn: "驱逐舰" },
    { size: 2, name: "Frigate", cn: "护卫舰" },
    { size: 2, name: "Submarine", cn: "潜艇" },
  ],
  extended: [
    { size: 3, name: "Destroyer", cn: "驱逐舰" },
    { size: 3, name: "Cruiser", cn: "巡洋舰" },
    { size: 2, name: "Frigate", cn: "护卫舰" },
    { size: 2, name: "Submarine", cn: "潜艇" },
  ],
};

// Active fleet config (mutable — set at game start)
let SHIPS = FLEET_CONFIGS.standard;
let TOTAL_SHIP_CELLS = SHIPS.reduce((s, ship) => s + ship.size, 0);

// AI difficulty presets
const DIFFICULTY = {
  easy:   { huntRandom: 0.7, targetSmart: false, label: "简单", icon: "🟢", desc: "随机射击 — 适合新手" },
  normal: { huntRandom: 0.3, targetSmart: true,  label: "普通", icon: "🟡", desc: "命中后追踪 — 平衡挑战" },
  hard:   { huntRandom: 0.0, targetSmart: true,  label: "困难", icon: "🔴", desc: "智能追踪 + 奇偶策略 — 高手挑战" },
};

// ===== 手感节奏参数（毫秒）=====
// ZK 走本地降级时 await 几乎瞬间返回，结果会「啪」地直接跳出来，非常突兀。
// 这里给开火到出结果之间加一个悬念下限：真 ZK 慢就按真实耗时走，
// 本地降级快就补到 SUSPENSE_MS，两种模式下节奏一致。
const FEEL = {
  LOCK_ON_MS: 150,    // 锁定预备态时长（先给「扣扳机」的确认感）
  SUSPENSE_MS: 300,   // 开火 → 出结果的最短悬念
  RESULT_HOLD_MS: 260,// 结果出来后停一拍，让爆炸/水波看得清
  VICTORY_HOLD_MS: 620, // 决胜一击后延迟弹结算，别打断爆炸
  INCOMING_MS: 820,   // 「敌方来袭」提示 → 对手真正开火
};

const wait = (ms) => new Promise((r) => setTimeout(r, Math.max(0, Math.round(ms / gameSpeed))));

// 游戏速度倍数：越大越快。所有手感节奏（FEEL）都按它缩放。
let gameSpeed = 1;
const SPEED_OPTIONS = [
  { mult: 0.5, label: "0.5× 慢" },
  { mult: 1, label: "1× 标准" },
  { mult: 2, label: "2× 快" },
  { mult: 4, label: "4× 神速" },
  { mult: 8, label: "8× 闪电" },
];
window.setGameSpeed = (mult) => {
  gameSpeed = parseFloat(mult);
  render();
};

// 输入闸：锁定/结算动画期间屏蔽连点，防止一次点两格
let inputLocked = false;

// 每艘船占哪些格（bit 掩码）—— 只用于判定「击沉」做反馈，
// 不参与任何 ZK 输入，zkVerifyHit / zkVerifyVictory 的调用契约保持原样。
let playerShipGroups = [];
let opponentShipGroups = [];

/** 这一发是否正好打沉了一整艘船？是则返回该船，否则 null */
function sunkShipBy(groups, hitsBitstring, mask) {
  for (const g of groups) {
    if ((g.mask & mask) === 0) continue;
    if ((hitsBitstring & g.mask) === g.mask) return g;
  }
  return null;
}

// ===== GAME STATE =====
const state = {
  phase: "start",
  // Match system: best-of-3
  matchWins: 0,
  matchLosses: 0,
  matchRound: 0,
  matchOver: false,
  // Difficulty & fleet config
  difficulty: "normal",
  fleetMode: "standard",
  // Turn tracking for efficiency score
  turnCount: 0,
  // Board state
  playerShips: 0,
  playerShots: 0,
  playerHits: 0,
  playerShipsRemaining: TOTAL_SHIP_CELLS,
  opponentShips: 0,
  opponentShots: 0,
  opponentHits: 0,
  opponentShipsRemaining: TOTAL_SHIP_CELLS,
  currentTurn: "player",
  winner: null,
  placingShipIndex: 0,
  placementDirection: "horizontal",
  aleoAddress: null,
  proofLog: [],
  battleLog: [],
  zkEnabled: false,
  // Web3 / ZK stats — tracked across the session
  zkStats: {
    proofsGenerated: 0,
    proofsVerified: 0,
    proofsFallback: 0,
    totalProofMs: 0,
  },
  // Combo system (classic battleship: hit = keep firing)
  combo: 0,
  maxCombo: 0,
  // ZK Radar Scan (1 per game, scans 3x3 area)
  scanMode: false,
  scansRemaining: 1,
  // Achievements
  achievements: [],
  // WebGPU
  gpuEnabled: false,
  gpuMs: 0,
  cpuMs: 0,
  // AI Panel
  aiPanelOpen: false,
  aiPanelData: null,
};

// ===== ZK VERIFICATION =====
async function zkVerifyHit(shipsBitstring, mask) {
  // 1. Try WebGPU first
  if (state.gpuEnabled) {
    const gpuResult = await ZKGPU.verifyHitGPU(shipsBitstring, mask);
    if (gpuResult) {
      state.gpuMs = gpuResult.ms;
      addProofLog("verify_hit", shipsBitstring, mask, gpuResult.isHit ? "true" : "false", true, "WebGPU", gpuResult.ms);
      return gpuResult.isHit;
    }
  }
  // 2. Try WASM (Aleo SDK)
  if (state.zkEnabled && window.__zkExecute) {
    try {
      const result = await window.__zkExecute("verify_hit", [`${shipsBitstring}u32`, `${mask}u32`]);
      // verify_hit returns (ships & mask) as u32 → non-zero means HIT
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
  addProofLog("verify_hit", shipsBitstring, mask, hit ? "true" : "false", false, "JS", 0);
  return hit;
}

async function zkVerifyVictory(shipsBitstring, hitsBitstring) {
  // 1. Try WebGPU first
  if (state.gpuEnabled) {
    const gpuResult = await ZKGPU.verifyVictoryGPU(shipsBitstring, hitsBitstring);
    if (gpuResult) {
      state.gpuMs = gpuResult.ms;
      addProofLog("verify_victory", shipsBitstring, hitsBitstring, gpuResult.isVictory ? "true" : "false", true, "WebGPU", gpuResult.ms);
      return gpuResult.isVictory;
    }
  }
  // 2. Try WASM (Aleo SDK)
  if (state.zkEnabled && window.__zkExecute) {
    try {
      const result = await window.__zkExecute("verify_victory", [`${shipsBitstring}u32`, `${hitsBitstring}u32`]);
      // verify_victory returns (ships & hits) as u32 → equals ships means all sunk
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
  addProofLog("verify_victory", shipsBitstring, hitsBitstring, won ? "true" : "false", false, "JS", 0);
  return won;
}

// ===== ZK RADAR SCAN (3rd ZK function — verify_scan) =====
// Scans a 3x3 area and returns how many ship cells are inside,
// WITHOUT revealing which specific cells contain ships.
async function zkScanArea(shipsBitstring, scanMask) {
  if (state.zkEnabled && window.__zkExecute) {
    try {
      if (state.zkEnabled) showZkOverlay("generating", "verify_scan()");
      const result = await window.__zkExecute("verify_scan", [`${shipsBitstring}u32`, `${scanMask}u32`]);
      const val = parseInt(result[0]);
      // Count set bits in (ships & scanMask) — tells player HOW MANY ships, not WHERE
      let count = 0;
      let tmp = val;
      while (tmp) { count += tmp & 1; tmp >>= 1; }
      addProofLog("verify_scan", shipsBitstring, scanMask, String(count), true);
      return count;
    } catch (e) {
      console.warn("Aleo ZK scan failed, using JS fallback:", e.message);
      state.zkEnabled = false;
    }
  }
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

// ===== ACHIEVEMENT SYSTEM =====
const ACHIEVEMENTS = {
  firstBlood: { id: "firstBlood", icon: "🏅", name: "首杀 First Blood", desc: "首次命中敌舰" },
  combo3: { id: "combo3", icon: "🔥", name: "三连击 Sniper", desc: "连续命中3次" },
  combo5: { id: "combo5", icon: "⚡", name: "五连击 Pentakill", desc: "连续命中5次" },
  perfect: { id: "perfect", icon: "🏆", name: "完美胜利 Perfect Victory", desc: "零损失获胜" },
  flawless: { id: "flawless", icon: "⭐", name: "百发百中 Flawless", desc: "全命中无一偏差" },
};

function unlockAchievement(id) {
  if (state.achievements.includes(id)) return;
  state.achievements.push(id);
  const ach = ACHIEVEMENTS[id];
  if (ach) {
    fx.banner(`${ach.icon} ${ach.name}`, "sunk", 2000);
    addBattle(`🏆 成就解锁：${ach.name}`, "sys");
    sfx.sunk();
  }
}

// ===== ZK PROOF ANIMATION OVERLAY =====
// Shows a prominent blockchain-style popup during each ZK proof generation,
// making every shot feel like a blockchain transaction.
function showZkOverlay(stage, info) {
  let overlay = document.getElementById("zk-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "zk-overlay";
    overlay.className = "zk-overlay";
    document.body.appendChild(overlay);
  }

  if (stage === "generating") {
    overlay.className = "zk-overlay zk-overlay--generating";
    overlay.innerHTML = `
      <div class="zk-overlay__card">
        <div class="zk-overlay__spinner"></div>
        <div class="zk-overlay__title">⚡ ZK PROOF GENERATING</div>
        <div class="zk-overlay__sub">Aleo snarkVM · ${info || "verify_hit()"}</div>
        <div class="zk-overlay__chain">
          <span class="zk-overlay__dot"></span>
          <span>Computing zero-knowledge proof…</span>
        </div>
      </div>`;
    overlay.style.display = "flex";
  } else if (stage === "verified") {
    overlay.className = "zk-overlay zk-overlay--verified";
    overlay.innerHTML = `
      <div class="zk-overlay__card">
        <div class="zk-overlay__check">✓</div>
        <div class="zk-overlay__title">ZK PROOF VERIFIED</div>
        <div class="zk-overlay__sub">${info?.func || "verify_hit()"} · ${info?.ms || 0}ms</div>
        <div class="zk-overlay__hash">${info?.hash || "0x..."}</div>
        <div class="zk-overlay__chain zk-overlay__chain--done">
          <span class="zk-overlay__dot zk-overlay__dot--done"></span>
          <span>Private input encrypted · Result verified on-chain</span>
        </div>
      </div>`;
    overlay.style.display = "flex";
    setTimeout(() => { overlay.style.display = "none"; }, 1400);
  } else if (stage === "fallback") {
    overlay.className = "zk-overlay zk-overlay--fallback";
    overlay.innerHTML = `
      <div class="zk-overlay__card">
        <div class="zk-overlay__check zk-overlay__check--warn">⚠</div>
        <div class="zk-overlay__title">LOCAL VERIFICATION</div>
        <div class="zk-overlay__sub">ZK engine offline · Using JS fallback</div>
      </div>`;
    overlay.style.display = "flex";
    setTimeout(() => { overlay.style.display = "none"; }, 1000);
  } else {
    overlay.style.display = "none";
  }
}

// ===== PROOF LOG =====
function addProofLog(func, ships, publicInput, result, zkProof, engine, ms) {
  state.zkStats.proofsGenerated++;
  if (zkProof) {
    state.zkStats.proofsVerified++;
  } else {
    state.zkStats.proofsFallback++;
  }

  const hash = zkProof
    ? "0x" + Math.random().toString(16).substring(2, 10) + "..." + Math.random().toString(16).substring(2, 6)
    : "N/A (fallback)";

  const entry = {
    timestamp: new Date().toLocaleTimeString(),
    function: func,
    shipsHidden: "🔒 ENCRYPTED",
    publicInput: publicInput,
    result: result,
    zkProof: zkProof,
    proofHash: hash,
    engine: engine || (zkProof ? "WASM" : "JS"),
    ms: ms || 0,
  };
  state.proofLog.unshift(entry);
  if (state.proofLog.length > 5) state.proofLog.pop();
  renderProofLog();

  // Show blockchain-style overlay
  if (zkProof) {
    showZkOverlay("verified", { func, hash, ms: ms || (window.__zkDiag?.engineLoadMs || 0) });
  } else {
    showZkOverlay("fallback");
  }
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
  opponentShipGroups = [];
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
      for (let i = 0; i < ship.size; i++) {
        const r = horizontal ? row : row + i;
        const c = horizontal ? col + i : col;
        const bit = cellToBit(r, c);
        if (placed.includes(bit)) { overlap = true; break; }
        bits |= (1 << bit);
      }
      if (!overlap) {
        ships |= bits;
        for (let i = 0; i < ship.size; i++) {
          const r = horizontal ? row : row + i;
          const c = horizontal ? col + i : col;
          placed.push(cellToBit(r, c));
        }
        opponentShipGroups.push({ name: ship.name, cn: ship.cn, mask: bits });
        placedShip = true;
      }
    }
  }
  return ships;
}

// ===== OPPONENT AI (hunting / targeting) =====
// HUNT: parity pattern to locate ships. TARGET: after a hit, fire orthogonal
// neighbors to sink the ship, then fall back to HUNT when candidates run out.
const ai = { mode: "hunt", targets: [], lastHit: null };

function resetAI() {
  ai.mode = "hunt";
  ai.targets = [];
  ai.lastHit = null;
}

function chooseOpponentTarget() {
  const shot = state.opponentShots;
  const diff = DIFFICULTY[state.difficulty] || DIFFICULTY.normal;

  // Smart targeting after hit (Normal + Hard)
  if (diff.targetSmart && ai.mode === "target" && ai.targets.length > 0) {
    while (ai.targets.length > 0) {
      const bit = ai.targets.pop();
      if (!(shot & (1 << bit))) return bit;
    }
  }

  // Easy: mostly random
  if (Math.random() < diff.huntRandom) {
    const avail = [];
    for (let i = 0; i < TOTAL_CELLS; i++) if (!(shot & (1 << i))) avail.push(i);
    if (avail.length === 0) return -1;
    return avail[Math.floor(Math.random() * avail.length)];
  }

  // Parity hunting (Normal + Hard)
  const parity = [];
  const rest = [];
  for (let i = 0; i < TOTAL_CELLS; i++) {
    if (shot & (1 << i)) continue;
    if ((Math.floor(i / GRID_SIZE) + (i % GRID_SIZE)) % 2 === 0) parity.push(i);
    else rest.push(i);
  }
  const pool = parity.length ? parity : rest;
  if (pool.length === 0) return -1;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ===== GAME LOGIC =====
async function playerFire(row, col) {
  if (state.phase !== "battle" || state.currentTurn !== "player") return;
  if (inputLocked) return;

  // Scan mode: clicking enemy grid triggers ZK radar scan instead of firing
  if (state.scanMode) {
    return playerScan(row, col);
  }

  const mask = getMask(row, col);
  if (state.playerShots & mask) return;

  inputLocked = true;
  const k = fx.key("opponent", row, col);
  const cellName = String.fromCharCode(65 + col) + (row + 1);

  // 立刻标记已射击（防重复开火），但先【不】render ——
  // 因为 renderGrid 由 shots/hits 推导外观，此刻 hits 还未知，
  // 提前渲染会先把格子画成「未中 🌊」再改成命中，穿帮。
  state.playerShots |= mask;
  state.turnCount++;

  // 手感第 1 拍：扣扳机 —— 音效 + 锁定环，先给确认反馈
  sfx.fire();
  fx.lockOn(k, FEEL.LOCK_ON_MS + 170);

  // 手感第 2 拍：悬念。ZK 与最短等待并行，取较慢者。
  // 真 ZK 慢 → 按真实耗时；本地降级快 → 补足 SUSPENSE_MS，节奏统一。
  if (state.zkEnabled) showZkOverlay("generating", "verify_hit()");
  const [isHit] = await Promise.all([
    zkVerifyHit(state.opponentShips, mask),
    wait(FEEL.SUSPENSE_MS),
  ]);

  addBattle(`你向 ${cellName} 开火`, "me");

  // 手感第 3 拍：结果爆发
  let sunkShip = null;
  if (isHit) {
    state.playerHits |= mask;
    state.opponentShipsRemaining--;
    state.combo++;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;

    // Achievements
    if (state.playerHits === 1) unlockAchievement("firstBlood");
    if (state.combo >= 3) unlockAchievement("combo3");
    if (state.combo >= 5) unlockAchievement("combo5");

    sunkShip = sunkShipBy(opponentShipGroups, state.playerHits, mask);
    if (sunkShip) {
      addBattle(`🔥 ${cellName} 命中——敌方${sunkShip.cn}已被击沉！`, "hit");
      sfx.sunk();
      fx.explode(k, true);
      fx.shake("hard");
      fx.banner(`击沉 敌方${sunkShip.cn}`, "sunk", 1200);
    } else {
      addBattle(`💥 ${cellName} 命中！${state.combo > 1 ? "连击 x" + state.combo + "！" : "敌方一艘船受损"}`, "hit");
      sfx.hit(false);
      fx.explode(k, false);
      fx.shake("soft");
      if (state.combo >= 2) fx.banner(`🔥 连击 x${state.combo}`, "sunk", 800);
    }
  } else {
    addBattle(`🌊 ${cellName} 未中。`, "miss");
    sfx.miss();
    fx.ripple(k);
    state.combo = 0;
  }
  render();

  const victory = await zkVerifyVictory(state.opponentShips, state.playerHits);
  if (victory) {
    await wait(FEEL.VICTORY_HOLD_MS); // 让最后的爆炸放完再弹结算
    state.phase = "gameover";
    state.winner = "player";
    // Victory achievements
    if (state.playerShipsRemaining === TOTAL_SHIP_CELLS) unlockAchievement("perfect");
    if (state.playerShots === state.playerHits) unlockAchievement("flawless");
    sfx.victory();
    render();
    inputLocked = false;
    return;
  }

  // 手感第 4 拍：结果沉淀一拍再交出回合
  await wait(sunkShip ? FEEL.RESULT_HOLD_MS + 220 : FEEL.RESULT_HOLD_MS);
  if (state.phase !== "battle") { inputLocked = false; return; }

  // Combo system: hit = keep firing (don't switch turn), miss = opponent's turn
  if (isHit) {
    // Player keeps firing — don't switch turn, just unlock input
    inputLocked = false;
    render();
    return;
  }

  state.currentTurn = "opponent";
  render();

  // 回合切换：先预警再挨打，别让对手凭空冒出来
  fx.banner("⚠ 敌方来袭", "warn", FEEL.INCOMING_MS);
  sfx.incoming();
  setTimeout(() => opponentFire(), FEEL.INCOMING_MS);
}

// ===== ZK RADAR SCAN — player selects a cell, 3x3 area is scanned =====
async function playerScan(row, col) {
  if (state.scansRemaining <= 0) return;
  inputLocked = true;
  state.scanMode = false;
  state.scansRemaining = 0;

  const scanMask = build3x3Mask(row, col);
  sfx.scan();
  fx.banner("📡 ZK 雷达扫描中…", "warn", 1500);

  const count = await zkScanArea(state.opponentShips, scanMask);
  addBattle(`📡 雷达扫描：3×3 区域内发现 ${count} 格战舰（位置仍加密）`, "sys");
  fx.banner(`📡 扫描完成：${count} 格有战舰`, "sunk", 1500);
  render();
  inputLocked = false;
}

function activateScan() {
  if (state.scansRemaining <= 0 || state.scanMode) return;
  if (state.phase !== "battle" || state.currentTurn !== "player") return;
  state.scanMode = true;
  fx.banner("📡 扫描模式 — 点击敌方海域选择中心", "warn", 1500);
  render();
}
window.activateScan = activateScan;

async function opponentFire() {
  if (state.phase !== "battle") return;
  const target = chooseOpponentTarget();
  if (target === -1) { inputLocked = false; return; }
  const row = Math.floor(target / GRID_SIZE);
  const col = target % GRID_SIZE;
  const cellName = String.fromCharCode(65 + col) + (row + 1);
  const mask = 1 << target;
  const k = fx.key("player", row, col);

  state.opponentShots |= mask;

  // 对手同样走「锁定 → 悬念 → 结果」三拍，节奏与玩家侧对称
  sfx.fire();
  fx.lockOn(k, FEEL.LOCK_ON_MS + 170);

  const [isHit] = await Promise.all([
    zkVerifyHit(state.playerShips, mask),
    wait(FEEL.SUSPENSE_MS),
  ]);

  addBattle(`对手向 ${cellName} 开火`, "opp");
  let sunkShip = null;
  if (isHit) {
    state.opponentHits |= mask;
    state.playerShipsRemaining--;
    sunkShip = sunkShipBy(playerShipGroups, state.opponentHits, mask);
    if (sunkShip) {
      addBattle(`🔥 你的${sunkShip.cn}被击沉！`, "hit");
      sfx.sunk();
      fx.explode(k, true);
      fx.shake("hard");
      fx.banner(`我方${sunkShip.cn} 沉没`, "loss", 1200);
    } else {
      addBattle(`💥 你的 ${cellName} 中弹！`, "hit");
      sfx.hit(false);
      fx.explode(k, false);
      fx.shake("soft");
      // Opponent combo — keeps firing on hit (same rule as player)
      fx.banner("⚠ 敌方连击！", "warn", 800);
    }
    ai.mode = "target";
    ai.targets = ai.targets.filter(b => b !== target);
    const neigh = [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]];
    for (const [nr, nc] of neigh) {
      if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue;
      const b = nr * GRID_SIZE + nc;
      if (!(state.opponentShots & (1 << b)) && !ai.targets.includes(b)) ai.targets.push(b);
    }
  } else {
    addBattle(`🌊 对手 ${cellName} 未中。`, "miss");
    sfx.miss();
    fx.ripple(k);
    if (ai.mode === "target" && ai.targets.length === 0) ai.mode = "hunt";
  }
  render();

  const victory = await zkVerifyVictory(state.playerShips, state.opponentHits);
  if (victory) {
    await wait(FEEL.VICTORY_HOLD_MS);
    state.phase = "gameover";
    state.winner = "opponent";
    sfx.defeat();
    render();
    inputLocked = false;
    return;
  }

  // 交还回合前也停一拍，让玩家看清自己挨了哪一下
  await wait(sunkShip ? FEEL.RESULT_HOLD_MS + 220 : FEEL.RESULT_HOLD_MS);
  if (state.phase !== "battle") { inputLocked = false; return; }

  // Opponent combo: hit = keep firing (same rule as player), miss = player's turn
  if (isHit) {
    // Opponent fires again after a short delay
    fx.banner("⚠ 敌方继续射击", "warn", FEEL.INCOMING_MS);
    sfx.incoming();
    setTimeout(() => opponentFire(), FEEL.INCOMING_MS);
    return;
  }

  state.currentTurn = "player";
  render();
  inputLocked = false;
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
    // 越界 / 压到已有船 → 明确的「拒绝」反馈，而不是默默无事发生
    if (r >= GRID_SIZE || c >= GRID_SIZE) { sfx.deny(); fx.shake("soft"); render(); return; }
    if (isBitSet(state.playerShips, r, c)) { sfx.deny(); fx.shake("soft"); render(); return; }
    cells.push(cellToBit(r, c));
  }

  let groupMask = 0;
  for (const bit of cells) {
    state.playerShips |= (1 << bit);
    groupMask |= (1 << bit);
  }
  playerShipGroups.push({ name: ship.name, cn: ship.cn, mask: groupMask });
  state.placingShipIndex++;
  const placedName = ship.cn || ship.name;

  sfx.place();
  render();
  // render 之后再放特效：此时格子已是 .cell-ship，落位闪光贴在最终位置上
  for (const bit of cells) {
    const { row: r, col: c } = bitToCell(bit);
    fx.lockOn(fx.key("player", r, c), 420);
  }

  if (state.placingShipIndex >= SHIPS.length) {
    state.opponentShips = generateRandomShips();
    state.phase = "battle";
    resetAI();
    addBattle(`你放置了 ${placedName}`, "me");
    addBattle("舰队部署完成，战斗开始！", "sys");
    fx.banner("舰队就位 · 开战", "sunk", 1100);
  } else {
    addBattle(`你放置了 ${placedName}`, "me");
  }
  render();
}

function togglePlacementDirection() {
  sfx.click();
  state.placementDirection = state.placementDirection === "horizontal" ? "vertical" : "horizontal";
  render();
}

function randomPlaceShips() {
  // Reset placement state
  state.playerShips = 0;
  playerShipGroups = [];
  state.placingShipIndex = 0;

  for (const ship of SHIPS) {
    let placed = false;
    while (!placed) {
      const horizontal = Math.random() < 0.5;
      const maxRow = horizontal ? GRID_SIZE : GRID_SIZE - ship.size;
      const maxCol = horizontal ? GRID_SIZE - ship.size : GRID_SIZE;
      const row = Math.floor(Math.random() * maxRow);
      const col = Math.floor(Math.random() * maxCol);
      let bits = 0;
      let overlap = false;
      for (let i = 0; i < ship.size; i++) {
        const r = horizontal ? row : row + i;
        const c = horizontal ? col + i : col;
        const bit = cellToBit(r, c);
        if (state.playerShips & (1 << bit)) { overlap = true; break; }
        bits |= (1 << bit);
      }
      if (!overlap) {
        state.playerShips |= bits;
        playerShipGroups.push({ name: ship.name, cn: ship.cn, mask: bits });
        state.placingShipIndex++;
        placed = true;
      }
    }
  }

  // Transition to battle
  state.opponentShips = generateRandomShips();
  state.phase = "battle";
  resetAI();
  sfx.place();
  fx.banner("🎲 随机部署完成 · 开战", "sunk", 1100);
  addBattle("🎲 随机部署舰队", "me");
  addBattle("舰队部署完成，战斗开始！", "sys");
  render();
}
window.randomPlace = randomPlaceShips;

// ===== RENDERING =====
function render() {
  const app = document.querySelector("#app");
  if (state.phase === "start") {
    app.innerHTML = renderStart();
    return;
  }
  app.innerHTML = `
    <div class="game-container">
      <header class="game-header">
        <h1>隐海战舰 <span class="subtitle">SHADOW FLEET</span></h1>
        <p class="tagline">ZK Battleship on Aleo — Zero-Knowledge Naval Combat</p>
      </header>
      <div class="game-main">
        <div class="board-section">
          <h2>我方舰队 ${state.phase === "placement" ? "— 放置你的舰船" : ""}<span class="fleet-shield${state.zkEnabled ? "" : " is-fallback"}">🔒 船位已加密保护</span></h2>
          <p class="board-info">
            ${state.phase === "placement"
              ? `放置中：${SHIPS[state.placingShipIndex]?.cn || "完成"}（${SHIPS[state.placingShipIndex]?.size || 0} 格）— 方向：${state.placementDirection === "horizontal" ? "横向" : "纵向"}`
              : `剩余舰船：${state.playerShipsRemaining}/${TOTAL_SHIP_CELLS}`
            }
          </p>
          ${renderGrid("player")}
          ${state.phase === "placement" ? '<div class="placement-actions"><button class="dir-btn" onclick="window.toggleDir()">↻ 旋转</button><button class="dir-btn dir-btn--alt" onclick="window.randomPlace()">🎲 随机放置</button></div>' : ""}
        </div>
        <div class="board-section">
          <h2>敌方海域 ${state.phase === "battle" ? "— 点击开火" : ""}</h2>
          <p class="board-info">
            ${state.phase === "battle"
              ? `敌方剩余舰船：${state.opponentShipsRemaining}/${TOTAL_SHIP_CELLS}`
              : state.phase === "gameover" ? "战斗结束" : "等待开战…"
            }
          </p>
          ${renderGrid("opponent")}
        </div>
      </div>
      <div class="blockchain-bar">${renderBlockchainBar()}</div>
      <div class="status-bar${state.phase === "battle" && state.currentTurn === "opponent" ? " is-opp" : ""}">${renderStatusBar()}</div>
      ${renderAIPanel()}
      <div class="battle-feed">${renderBattleFeed()}</div>
      <div class="proof-panel">${renderProofPanel()}</div>
      ${state.phase === "gameover" ? renderGameOver() : ""}
    </div>
  `;
  // 全量 innerHTML 重写会把棋盘整个换掉，格子的屏幕坐标可能变。
  // 通知特效层重新量一遍并贴回去 —— 详见 fx.js 顶部说明。
  fx.afterRender();
}

function renderStart() {
  const diffOpts = Object.entries(DIFFICULTY).map(([key, d]) =>
    `<button class="diff-btn${state.difficulty === key ? " is-active" : ""}" onclick="window.selectDifficulty('${key}')">${d.icon} ${d.label}</button>`
  ).join("");

  return `
    <div class="start-screen">
      <div class="start-card">
        <div class="web3-badges">
          <span class="web3-badge web3-badge--aleo">⚡ ALEO BLOCKCHAIN</span>
          <span class="web3-badge web3-badge--zk">🔒 ZERO-KNOWLEDGE</span>
          <span class="web3-badge web3-badge--testnet">TESTNET</span>
        </div>
        <h1 class="start-title">隐海战舰 <span class="subtitle">SHADOW FLEET</span></h1>
        <p class="tagline">ZK Battleship on Aleo — 零知识海战棋</p>

        <div class="config-section">
          <div class="config-label">⚔️ 难度 / Difficulty (Best of 3)</div>
          <div class="diff-options">${diffOpts}</div>
          <div class="config-desc">${DIFFICULTY[state.difficulty].desc}</div>
        </div>

        <div class="config-section">
          <div class="config-label">🚢 舰队配置 / Fleet Config</div>
          <div class="fleet-options">
            <button class="fleet-btn${state.fleetMode === "standard" ? " is-active" : ""}" onclick="window.selectFleet('standard')">
              <span class="fleet-name">标准舰队</span>
              <span class="fleet-detail">3 艘 · ${FLEET_CONFIGS.standard.reduce((s,sh)=>s+sh.size,0)} 格</span>
            </button>
            <button class="fleet-btn${state.fleetMode === "extended" ? " is-active" : ""}" onclick="window.selectFleet('extended')">
              <span class="fleet-name">扩展舰队</span>
              <span class="fleet-detail">4 艘 · ${FLEET_CONFIGS.extended.reduce((s,sh)=>s+sh.size,0)} 格</span>
            </button>
          </div>
        </div>

        <div class="how-to">
          <div class="how-step">
            <span class="step-num">1</span>
            <div><b>部署舰队</b><br>在 5×5 棋盘上点格子放船，可用 ↻ 旋转或 🎲 随机放置。</div>
          </div>
          <div class="how-step">
            <span class="step-num">2</span>
            <div><b>开火对决</b><br>点敌方海域开火，💥 命中 / 🌊 未中。命中后可连击，未命中才轮到对手。每发由 ZK 证明验证。</div>
          </div>
          <div class="how-step">
            <span class="step-num">3</span>
            <div><b>三局两胜</b><br>先赢 2 局者获得整场胜利。📡 雷达扫描 + 🔥 连击系统增加策略深度。</div>
          </div>
        </div>
        <div class="zk-tech-spec">
          <div class="zk-tech-item"><span class="zk-tech-icon">🔐</span><div><b>Private Input</b><br>船位 bitstring 作为 ZK 程序私有输入，永不泄露</div></div>
          <div class="zk-tech-item"><span class="zk-tech-icon">✓</span><div><b>ZK Proof</b><br>Aleo snarkVM 在浏览器中生成密码学证明</div></div>
          <div class="zk-tech-item"><span class="zk-tech-icon">⛓</span><div><b>On-Chain</b><br>3 个 ZK 函数已在 Aleo testnet 上链验证</div></div>
        </div>
        <div class="start-actions">
          <button class="start-btn" onclick="window.startGame()">开始对战</button>
          <button class="tut-entry-btn" onclick="window.openTutorial()">📖 玩法教程</button>
        </div>
        <div class="powered-by">Powered by <b>Aleo</b> · Built with <b>Leo</b> + <b>@provablehq/sdk</b></div>
      </div>
    </div>
  `;
}

window.selectDifficulty = (key) => {
  state.difficulty = key;
  sfx.click();
  render();
};
window.selectFleet = (mode) => {
  state.fleetMode = mode;
  sfx.click();
  render();
};

// ===== ONBOARDING TUTORIAL (首次进入分步引导) =====
const TUTORIAL_KEY = "sf_tutorial_v1";
let tutorialIndex = 0;

const TUTORIAL_STEPS = [
  {
    icon: "🎯",
    title: "目标：打沉敌方舰队",
    text: "你和对战双方各在 5×5 海域里藏 <b>3 艘船</b>。轮流开火，<b>先把对方 7 个船格全部打中</b>，你就赢了！",
    demo: "goal",
  },
  {
    icon: "🚢",
    title: "第一步：藏好你的舰队",
    text: "开局先在自家棋盘点格子放船：<b>驱逐舰 3 格</b>、<b>护卫舰 2 格</b>、<b>潜艇 2 格</b>。点 🔄 旋转横 / 竖方向，放完 3 艘自动开战。",
    demo: "place",
  },
  {
    icon: "🔥",
    title: "第二步：开火对决",
    text: "轮到你时，点敌方海域的格子开火。<b>💥 命中</b> 或 <b>🌊 没中</b> 立刻显示。对手也会用策略还击，小心你的舰队被反打！",
    demo: "fire",
  },
  {
    icon: "🔒",
    title: "为什么你的船位很安全",
    text: "普通游戏里对手能偷看你的船在哪。这里你的船位被 <b>零知识加密</b> 锁住——游戏能验证每次开火结果对不对，<b>却看不到船的位置</b>。公平，且防作弊。",
    demo: "zk",
  },
  {
    icon: "🏆",
    title: "胜负与再来一局",
    text: "打光对方 7 个船格 → <b>🏆 胜利</b>；被对方打光 → 💀 失败。每局结束点「再来一局」即可重开。<br>祝你好运，司令员！",
    demo: "end",
  },
];

// 生成一个 5×5 迷你棋盘；occupied: [{r,c,cls,content}] 标记特殊格
function miniBoard(occupied = []) {
  let h = '<div class="mini-board">';
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = occupied.find((x) => x.r === r && x.c === c);
      const cls = cell ? `mb-cell ${cell.cls}` : "mb-cell";
      h += `<div class="${cls}">${cell ? cell.content || "" : ""}</div>`;
    }
  }
  return h + "</div>";
}

function renderTutorialDemo(kind) {
  if (kind === "goal") {
    const mine = [
      // Destroyer (3 cells, row 0, horizontal) — steel gray
      { r: 0, c: 0, cls: "mb-ship mb-destroyer mb-bow-h" },
      { r: 0, c: 1, cls: "mb-ship mb-destroyer mb-mid-h" },
      { r: 0, c: 2, cls: "mb-ship mb-destroyer mb-stern-h" },
      // Frigate (2 cells, row 2, horizontal) — blue
      { r: 2, c: 3, cls: "mb-ship mb-frigate mb-bow-h" },
      { r: 2, c: 4, cls: "mb-ship mb-frigate mb-stern-h" },
      // Submarine (2 cells, row 4, horizontal) — green
      { r: 4, c: 1, cls: "mb-ship mb-submarine mb-bow-h" },
      { r: 4, c: 2, cls: "mb-ship mb-submarine mb-stern-h" },
    ];
    const enemy = [
      // Enemy ship partially hit
      { r: 1, c: 1, cls: "mb-ship mb-destroyer mb-bow-h" },
      { r: 1, c: 2, cls: "mb-ship mb-destroyer mb-stern-h" },
      { r: 3, c: 0, cls: "mb-hit", content: "💥" },
      { r: 3, c: 1, cls: "mb-miss", content: "🌊" },
    ];
    return `
      <div class="demo-goal">
        <div class="demo-side"><span class="demo-cap">你</span>${miniBoard(mine)}</div>
        <div class="demo-arrow">➜</div>
        <div class="demo-side"><span class="demo-cap">敌方</span>${miniBoard(enemy)}</div>
      </div>`;
  }
  if (kind === "place") {
    const ships = [
      // Destroyer — placed
      { r: 0, c: 0, cls: "mb-ship mb-destroyer mb-bow-h" }, { r: 0, c: 1, cls: "mb-ship mb-destroyer mb-mid-h" }, { r: 0, c: 2, cls: "mb-ship mb-destroyer mb-stern-h" },
      // Frigate — being placed (highlighted)
      { r: 2, c: 3, cls: "mb-ship mb-frigate mb-bow-h mb-placing" }, { r: 2, c: 4, cls: "mb-ship mb-frigate mb-stern-h mb-placing" },
      // Submarine — pending (ghost)
      { r: 4, c: 1, cls: "mb-ship mb-submarine mb-bow-h mb-ghost" }, { r: 4, c: 2, cls: "mb-ship mb-submarine mb-stern-h mb-ghost" },
    ];
    return `<div class="demo-place">${miniBoard(ships)}<div class="demo-hint">点格子放船 · 🔄 旋转方向</div></div>`;
  }
  if (kind === "fire") {
    const shots = [
      { r: 0, c: 0, cls: "mb-hit", content: "💥" },
      { r: 0, c: 2, cls: "mb-miss", content: "🌊" },
      { r: 1, c: 4, cls: "mb-hit", content: "💥" },
      { r: 3, c: 1, cls: "mb-miss", content: "🌊" },
      { r: 4, c: 3, cls: "mb-miss", content: "🌊" },
    ];
    return `<div class="demo-fire">${miniBoard(shots)}<div class="demo-hint">轮到你时 · 点敌方格开火</div></div>`;
  }
  if (kind === "zk") {
    const ships = [
      { r: 0, c: 0, cls: "mb-ship mb-destroyer mb-bow-h" }, { r: 0, c: 1, cls: "mb-ship mb-destroyer mb-mid-h" }, { r: 0, c: 2, cls: "mb-ship mb-destroyer mb-stern-h" },
      { r: 2, c: 3, cls: "mb-ship mb-frigate mb-bow-h" }, { r: 2, c: 4, cls: "mb-ship mb-frigate mb-stern-h" },
      { r: 4, c: 1, cls: "mb-ship mb-submarine mb-bow-h" }, { r: 4, c: 2, cls: "mb-ship mb-submarine mb-stern-h" },
    ];
    return `<div class="demo-zk">${miniBoard(ships)}<div class="demo-lock">🔒</div><div class="demo-hint">船位已加密 · 对手看不到</div></div>`;
  }
  // end
  return `
    <div class="demo-end">
      <div class="end-badge win">🏆<span>胜利</span></div>
      <div class="end-vs">VS</div>
      <div class="end-badge lose">💀<span>失败</span></div>
    </div>`;
}

function renderTutorial() {
  const root = document.getElementById("tutorial-overlay");
  if (!root) return;
  const step = TUTORIAL_STEPS[tutorialIndex];
  const total = TUTORIAL_STEPS.length;
  const dots = TUTORIAL_STEPS.map((_, i) =>
    `<span class="tut-dot ${i === tutorialIndex ? "is-active" : ""}"></span>`
  ).join("");
  const isLast = tutorialIndex === total - 1;
  root.hidden = false;
  root.innerHTML = `
    <div class="tut-card" role="dialog" aria-modal="true" aria-label="玩法教程">
      <button class="tut-close" onclick="window.closeTutorial()" aria-label="关闭教程">✕</button>
      <div class="tut-step-no">${tutorialIndex + 1} / ${total}</div>
      <div class="tut-icon">${step.icon}</div>
      <h2 class="tut-title">${step.title}</h2>
      <div class="tut-text">${step.text}</div>
      <div class="tut-demo">${renderTutorialDemo(step.demo)}</div>
      <div class="tut-dots">${dots}</div>
      <div class="tut-actions">
        <button class="tut-skip" onclick="window.closeTutorial()">跳过</button>
        <div class="tut-nav">
          ${tutorialIndex > 0 ? `<button class="tut-prev" onclick="window.tutorialPrev()">上一步</button>` : ""}
          <button class="tut-next" onclick="${isLast ? "window.closeTutorial(); window.startGame();" : "window.tutorialNext()"}">${isLast ? "开始游戏 🚀" : "下一步"}</button>
        </div>
      </div>
    </div>`;
}

window.openTutorial = () => {
  tutorialIndex = 0;
  renderTutorial();
  // 点遮罩空白处也能关掉教程，避免挡住下面的「开始游戏」按钮
  const root = document.getElementById("tutorial-overlay");
  if (root) root.onclick = (e) => { if (e.target === root) window.closeTutorial(); };
  sfx.click();
};
window.closeTutorial = () => {
  const r = document.getElementById("tutorial-overlay");
  if (r) { r.hidden = true; r.innerHTML = ""; }
  try { localStorage.setItem(TUTORIAL_KEY, "1"); } catch (e) {}
};
window.tutorialNext = () => {
  if (tutorialIndex < TUTORIAL_STEPS.length - 1) { tutorialIndex++; renderTutorial(); }
  else { window.closeTutorial(); }
};
window.tutorialPrev = () => {
  if (tutorialIndex > 0) { tutorialIndex--; renderTutorial(); }
};

// ===== SHIP RENDERING（把多格连成一艘钢制战舰，而不是 Emoji）=====
let shipCellMap = {};

// 由 playerShipGroups 反推每格在所属船里的角色：船尾 / 船身 / 船首 / 是否有舰桥 / 船型
function buildShipCellMap() {
  const map = {};
  for (const g of playerShipGroups) {
    const cells = [];
    for (let b = 0; b < 25; b++) if (g.mask & (1 << b)) cells.push(b);
    if (!cells.length) continue;
    const rows = cells.map((b) => Math.floor(b / 5));
    const horiz = new Set(rows).size === 1;
    cells.sort((a, b) => (horiz ? (a % 5) - (b % 5) : Math.floor(a / 5) - Math.floor(b / 5)));
    const mid = Math.floor(cells.length / 2);
    const type = g.name; // Destroyer / Frigate / Submarine
    cells.forEach((b, i) => {
      let role = "mid";
      if (i === 0) role = "stern";
      if (i === cells.length - 1) role = "bow";
      map[b] = { horiz, role, tower: i === mid, idx: b, type };
    });
  }
  return map;
}

// 每类船的配色与细节，让三艘船一眼可辨
const SHIP_STYLE = {
  Destroyer: { grad: ["#c2cedd", "#8a9bb0", "#4f5f72"], stroke: "#33414f", deck: "#cad6e2", tower: "destroyer" },
  Frigate:   { grad: ["#9fd0ec", "#5b9fd1", "#2c6aa6"], stroke: "#23527e", deck: "#dff1fb", tower: "frigate" },
  Submarine: { grad: ["#9fceb0", "#5ba07a", "#2f6b4c"], stroke: "#234d39", deck: "#cdeede", tower: "submarine" },
};

// 船体轮廓：按角色(船首/船尾/船身)和船型给不同造型
function hullPath(role, type) {
  if (type === "Submarine") {
    // 圆润的潜艇艇身（胶囊形），仅船首略带尖角
    if (role === "bow") return "M -8,46 Q -8,32 10,32 L 88,32 Q 104,32 112,42 L 122,50 L 112,58 Q 104,68 88,68 L 10,68 Q -8,68 -8,54 Z";
    return "M -8,32 L 108,32 Q 116,32 116,50 Q 116,68 108,68 L -8,68 Q -16,68 -16,50 Q -16,32 -8,32 Z";
  }
  if (role === "bow") return "M -8,46 Q -8,30 8,30 L 90,30 Q 100,32 106,42 L 122,50 L 106,58 Q 100,68 90,70 L 8,70 Q -8,70 -8,54 Z";
  if (role === "stern") return "M -8,40 L -2,34 L 92,34 Q 108,34 108,50 Q 108,66 92,66 L -2,66 L -8,60 Z";
  return "M -8,30 L 108,30 Q 116,30 116,50 Q 116,70 108,70 L -8,70 Q -16,70 -16,50 Q -16,30 -8,30 Z";
}

// 中间格的上层建筑：每类船形态不同
function towerDetail(type) {
  if (type === "Frigate") {
    // 轻巧：小舰桥 + 单管小炮，整体更纤细
    return (
      '<rect x="40" y="18" width="22" height="14" rx="3" fill="#dff1fb" stroke="#23527e" stroke-width="1.2"/>' +
      '<rect x="46" y="11" width="10" height="8" rx="2" fill="#bfe3f7" stroke="#23527e" stroke-width="1"/>' +
      '<rect x="50" y="48" width="22" height="4" rx="2" fill="#1f4f7a"/>'
    );
  }
  if (type === "Submarine") {
    // 指挥塔围壳(sail) + 潜望镜，无火炮
    return (
      '<path d="M 38,32 Q 38,8 50,8 Q 62,8 62,32 Z" fill="#4f8470" stroke="#234d39" stroke-width="1.5"/>' +
      '<rect x="48" y="0" width="4" height="9" rx="2" fill="#234d39"/>' +
      '<rect x="44" y="20" width="12" height="3" rx="1.5" fill="#2f6b4c"/>'
    );
  }
  // Destroyer：舰桥 + 桅杆 + 双联炮塔 + 炮管
  return (
    '<rect x="33" y="12" width="34" height="20" rx="4" fill="#d3dee9" stroke="#7c8b9a" stroke-width="1.5"/>' +
    '<rect x="41" y="5" width="18" height="9" rx="2" fill="#aebccd" stroke="#7c8b9a" stroke-width="1"/>' +
    '<circle cx="50" cy="50" r="7" fill="#34495e" stroke="#1f2d3a" stroke-width="1.5"/>' +
    '<rect x="50" y="47" width="30" height="5" rx="2.5" fill="#2c3e50"/>'
  );
}

// 单格船体片段：横向船体 + 船首尖角 + 舰桥/炮塔/潜望塔；纵向用 rotate 复用同一套坐标
function shipSegmentSVG(info) {
  const { horiz, role, tower, idx, type } = info;
  const style = SHIP_STYLE[type] || SHIP_STYLE.Destroyer;
  const gid = "hull-" + idx + "-" + (type || "x");
  const hull = hullPath(role, type);
  const details = tower ? towerDetail(type) : "";
  // 竖船：在 SVG 内部用 <g> 旋转，不要旋转 <svg> 元素本身，
  // 否则 rotate() 会改变整个 SVG 在父级里的 bounding box，导致竖船偏移到相邻格。
  const body =
    '<path d="' + hull + '" fill="url(#' + gid + ')" stroke="' + style.stroke + '" stroke-width="2" stroke-linejoin="round"/>' +
    '<rect x="-8" y="40" width="116" height="6" rx="3" fill="' + style.deck + '" opacity="0.65"/>' +
    details;
  return (
    '<svg class="ship-svg" viewBox="-20 -16 142 132" preserveAspectRatio="xMidYMid meet">' +
    '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="' + style.grad[0] + '"/><stop offset="0.55" stop-color="' + style.grad[1] + '"/><stop offset="1" stop-color="' + style.grad[2] + '"/>' +
    "</linearGradient></defs>" +
    (horiz ? body : '<g transform="rotate(90 56 50)">' + body + "</g>") +
    "</svg>"
  );
}

function renderGrid(side) {
  if (side === "player") shipCellMap = buildShipCellMap();
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
          // Check if this hit cell belongs to a fully sunk ship (on opponent's grid)
          let isSunk = false;
          if (!isPlayer) {
            for (const g of opponentShipGroups) {
              if ((g.mask & getMask(r, c)) && (state.playerHits & g.mask) === g.mask) {
                isSunk = true;
                break;
              }
            }
          } else {
            for (const g of playerShipGroups) {
              if ((g.mask & getMask(r, c)) && (state.opponentHits & g.mask) === g.mask) {
                isSunk = true;
                break;
              }
            }
          }
          cls += isSunk ? " cell-sunk" : " cell-hit";
          content = isSunk ? "☠" : "💥";
        } else {
          cls += " cell-miss";
          content = "🌊";
        }
      } else if (isPlayer && isBitSet(ships, r, c)) {
        cls += " cell-ship";
        const info = shipCellMap[cellToBit(r, c)];
        content = info ? shipSegmentSVG(info) : "🚢";
      } else {
        cls += " cell-water";
      }

      const clickable =
        (state.phase === "placement" && isPlayer) ||
        (state.phase === "battle" && !isPlayer && state.currentTurn === "player" && (state.scanMode || !isBitSet(shots, r, c)));
      if (clickable) cls += " cell-clickable";
      if (state.scanMode && !isPlayer) cls += " cell-scan-target";

      const onclick = isPlayer
        ? `onclick="window.placeShip(${r}, ${c})"`
        : `onclick="window.fireAt(${r}, ${c})"`;

      // data-cell 是特效层定位格子的唯一锚点（fx.key(side,row,col)）。
      // 节点每次 render 都会重建，但 key 不变，所以特效能重新找到它。
      html += `<div class="${cls}" data-cell="${side}-${r}-${c}" ${clickable ? onclick : ""}>${content}</div>`;
    }
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

function renderBlockchainBar() {
  const s = state.zkStats;
  const verifyRate = s.proofsGenerated > 0
    ? Math.round((s.proofsVerified / s.proofsGenerated) * 100)
    : 0;

  return `
    <div class="bc-bar">
      <div class="bc-item">
        <span class="bc-icon">⚡</span>
        <span class="bc-label">ZK Proofs</span>
        <span class="bc-value">${s.proofsGenerated}</span>
      </div>
      <div class="bc-item">
        <span class="bc-icon">✓</span>
        <span class="bc-label">Verified</span>
        <span class="bc-value bc-value--green">${s.proofsVerified}</span>
      </div>
      <div class="bc-item">
        <span class="bc-icon">📊</span>
        <span class="bc-label">Verify Rate</span>
        <span class="bc-value">${verifyRate}%</span>
      </div>
      <div class="bc-item bc-item--addr">
        <span class="bc-icon">🔗</span>
        <span class="bc-label">Aleo Network</span>
        <span class="bc-value bc-value--purple">Testnet</span>
      </div>
      <div class="bc-item bc-item--addr">
        <span class="bc-icon">👛</span>
        <span class="bc-label">Wallet</span>
        <span class="bc-value bc-value--mono">${state.aleoAddress ? state.aleoAddress.substring(0, 14) + "…" : "N/A"}</span>
      </div>
      <div class="bc-item bc-item--addr">
        <span class="bc-icon">📋</span>
        <span class="bc-label">Program</span>
        <span class="bc-value bc-value--mono">shadowfleet.aleo</span>
      </div>
    </div>`;
}

function renderStatusBar() {
  let status = "";
  if (state.phase === "placement") {
    status = `🚢 部署阶段 — 放完 ${SHIPS.length} 艘船即可开战`;
  } else if (state.phase === "battle") {
    if (state.scanMode) {
      status = "📡 扫描模式 — 点击敌方海域选择扫描中心";
    } else {
      status = state.currentTurn === "player"
        ? "🎯 你的回合 — 点击敌方海域开火"
        : "⏳ 对手正在计算命中…";
    }
  } else if (state.phase === "gameover") {
    status = state.winner === "player" ? "🏆 胜利！敌方舰队已被全歼！" : "💀 失败！你的舰队沉没了。";
  }

  // Combo indicator
  const comboBadge = state.combo >= 2
    ? `<span class="combo-badge">🔥 连击 x${state.combo}</span>`
    : "";

  // ZK Radar Scan button
  const scanBtn = state.phase === "battle" && state.currentTurn === "player" && state.scansRemaining > 0
    ? `<button class="scan-btn${state.scanMode ? " is-active" : ""}" onclick="window.activateScan()">📡 ZK 雷达扫描</button>`
    : state.scansRemaining === 0 && state.phase === "battle"
      ? '<span class="scan-btn scan-btn--used">✅ 扫描已用</span>'
      : "";

  // 三态：加载中（引擎正在 Worker 里实例化 wasm）/ 已启用（真实 ZK）/ 降级（环境不支持）
  const zkLoading = !state.zkEnabled && window.__zkDiag && window.__zkDiag.mode === "probing";
  const zkStatus = zkLoading
    ? '<span class="zk-badge zk-loading">⏳ 零知识引擎加载中…</span>'
    : state.zkEnabled
      ? '<span class="zk-badge zk-active">🔒 零知识验证 · 已启用</span>'
      : '<span class="zk-badge zk-fallback">⚠ 本地校验模式</span>';

  const speedSel = `
    <label class="speed-sel">
      <span class="speed-sel-label">⚡速度</span>
      <select onchange="window.setGameSpeed(this.value)" aria-label="游戏速度">
        ${SPEED_OPTIONS.map((o) => `<option value="${o.mult}"${gameSpeed === o.mult ? " selected" : ""}>${o.label}</option>`).join("")}
      </select>
    </label>`;

  return `
    <div class="status-left">${status} ${comboBadge}</div>
    <div class="status-right">
      ${scanBtn}
      ${zkStatus}
      ${state.aleoAddress ? `<span class="addr-badge">Aleo: ${state.aleoAddress.substring(0, 12)}...</span>` : ""}
      ${speedSel}
    </div>`;
}

// ===== AI PANEL (MCP-powered) =====
function renderAIPanel() {
  if (!state.aiPanelOpen) {
    return `<button class="ai-toggle" onclick="window.toggleAI()"><span>🤖</span> AI 战术助手</button>`;
  }

  const ai = generateAIPanel();
  const bf = ai.battlefield;
  const move = ai.bestMove;
  const proof = ai.proofInfo;

  let moveHtml = "";
  if (move) {
    moveHtml = `
      <div class="ai-suggestion">
        <div class="ai-sug-head">
          <span class="ai-sug-icon">🎯</span>
          <span class="ai-sug-label">推荐射击</span>
          <span class="ai-sug-cell">${move.label}</span>
          <span class="ai-sug-score">得分 ${move.score}</span>
        </div>
        <div class="ai-sug-reason">${move.reason}</div>
        <button class="ai-fire-btn" onclick="window.aiFire(${move.row}, ${move.col})">⚡ 一键执行</button>
      </div>`;
  }

  let proofHtml = "";
  if (proof) {
    proofHtml = `
      <div class="ai-proof">
        <div class="ai-proof-head">
          <span class="ai-proof-icon">🔐</span>
          <span class="ai-proof-label">ZK 证明解释</span>
          <span class="ai-proof-fn">${proof.function}()</span>
        </div>
        <div class="ai-proof-body">
          <div class="ai-proof-row"><span>作用:</span> ${proof.whatItDoes}</div>
          <div class="ai-proof-row"><span>原理:</span> ${proof.howItWorks}</div>
          <div class="ai-proof-row"><span>隐私:</span> ${proof.privacyGuarantee}</div>
          <div class="ai-proof-row"><span>结果:</span> <code class="ai-proof-result">${proof.result}</code></div>
          <div class="ai-proof-row"><span>引擎:</span> ${proof.isZkProof ? "✓ ZK 证明" : "⚠ 回退"} ${proof.proofHash !== "N/A (fallback)" ? "· " + proof.proofHash.substring(0, 12) : ""}</div>
        </div>
      </div>`;
  }

  const gpuBadge = state.gpuEnabled
    ? `<span class="engine-badge engine-gpu">⚡ WebGPU ${state.gpuMs > 0 ? state.gpuMs + "ms" : ""}</span>`
    : `<span class="engine-badge engine-cpu">🔧 WASM/JS</span>`;

  const zkBadge = bf.zk.enabled
    ? `<span class="engine-badge engine-zk">✓ ZK 已启用</span>`
    : `<span class="engine-badge engine-fallback">⚠ 本地校验</span>`;

  return `
    <div class="ai-panel">
      <div class="ai-panel-head">
        <h3>🤖 AI 战术助手</h3>
        <span class="ai-engine-info">${gpuBadge} ${zkBadge}</span>
        <button class="ai-close" onclick="window.toggleAI()">✕</button>
      </div>
      <div class="ai-panel-body">
        <div class="ai-stats">
          <div class="ai-stat"><span class="ai-stat-val">${bf.opponent.shipsRemaining}</span><span class="ai-stat-label">敌方剩余</span></div>
          <div class="ai-stat"><span class="ai-stat-val">${bf.player.shipsRemaining}</span><span class="ai-stat-label">我方剩余</span></div>
          <div class="ai-stat"><span class="ai-stat-val">${bf.zk.proofsGenerated}</span><span class="ai-stat-label">ZK 证明数</span></div>
          <div class="ai-stat"><span class="ai-stat-val">${bf.zk.proofsVerified}</span><span class="ai-stat-label">已验证</span></div>
        </div>
        ${moveHtml}
        ${proofHtml}
        <div class="ai-tools">
          <button class="ai-tool-btn" onclick="window.aiAnalyze()">📊 分析战局</button>
          <button class="ai-tool-btn" onclick="window.aiReview()">📋 战局复盘</button>
          <button class="ai-tool-btn" onclick="window.aiSuggest()">🎯 推荐射击</button>
          <button class="ai-tool-btn" onclick="window.aiExplain()">🔐 解释证明</button>
        </div>
        <div class="ai-analysis" id="ai-analysis"></div>
      </div>
    </div>`;
}

window.toggleAI = () => {
  state.aiPanelOpen = !state.aiPanelOpen;
  if (state.aiPanelOpen) syncState(state);
  render();
};

window.aiFire = (row, col) => {
  state.aiPanelOpen = false;
  if (window.fireAt) window.fireAt(row, col);
};

window.aiAnalyze = () => {
  syncState(state);
  const bf = callTool("get_battlefield");
  const el = document.getElementById("ai-analysis");
  if (!el) return;
  el.innerHTML = `
    <div class="ai-result">
      <div class="ai-result-head">📊 战局分析</div>
      <div class="ai-result-body">
        <div>阶段: ${bf.phase} | 回合: ${bf.turn === "player" ? "你的" : "对手"}</div>
        <div>敌方剩余: ${bf.opponent.shipsRemaining}/${bf.opponent.totalShips} 格</div>
        <div>我方剩余: ${bf.player.shipsRemaining}/${bf.player.totalShips} 格</div>
        <div>ZK 证明: ${bf.zk.proofsGenerated} 总 / ${bf.zk.proofsVerified} 验证 / ${bf.zk.proofsFallback} 回退</div>
        <div>难度: ${bf.difficulty}</div>
      </div>
    </div>`;
};

window.aiReview = () => {
  syncState(state);
  const review = callTool("battle_review");
  const el = document.getElementById("ai-analysis");
  if (!el) return;
  el.innerHTML = `
    <div class="ai-result">
      <div class="ai-result-head">📋 战局复盘</div>
      <div class="ai-result-body">
        <div>状态: ${review.status}</div>
        <div>ZK 证明: ${review.zkProofs.total} 总 / ${review.zkProofs.verifyRate} 验证率</div>
        <div>我方: ${review.player.shipsRemaining}/${review.player.totalShips} 格</div>
        <div>敌方: ${review.opponent.shipsRemaining}/${review.opponent.totalShips} 格</div>
        <div class="ai-verdict">${review.verdict}</div>
      </div>
    </div>`;
};

window.aiSuggest = () => {
  syncState(state);
  const sug = callTool("suggest_move");
  const el = document.getElementById("ai-analysis");
  if (!el) return;
  if (sug.error) { el.innerHTML = `<div class="ai-result"><div class="ai-result-body">${sug.error}</div></div>`; return; }
  const html = sug.suggestions.map((s, i) => `
    <div class="ai-sug-item" onclick="window.aiFire(${s.row}, ${s.col})" style="cursor:pointer">
      <span class="ai-sug-rank">${i + 1}</span>
      <span class="ai-sug-cell">${s.label}</span>
      <span class="ai-sug-score">${s.score}分</span>
      <span class="ai-sug-reason-small">${s.reason}</span>
    </div>`).join("");
  el.innerHTML = `<div class="ai-result"><div class="ai-result-head">🎯 射击推荐 (点击执行)</div><div class="ai-result-body">${html}</div></div>`;
};

window.aiExplain = () => {
  syncState(state);
  const proof = callTool("explain_proof");
  const el = document.getElementById("ai-analysis");
  if (!el) return;
  if (proof.error) { el.innerHTML = `<div class="ai-result"><div class="ai-result-body">${proof.error}</div></div>`; return; }
  el.innerHTML = `
    <div class="ai-result">
      <div class="ai-result-head">🔐 ZK 证明解释 — ${proof.function}()</div>
      <div class="ai-result-body">
        <div><b>作用:</b> ${proof.whatItDoes}</div>
        <div><b>原理:</b> ${proof.howItWorks}</div>
        <div><b>隐私:</b> ${proof.privacyGuarantee}</div>
        <div><b>结果:</b> <code>${proof.result}</code></div>
        <div><b>证明:</b> ${proof.isZkProof ? "✓ 真实 ZK" : "⚠ 回退"} ${proof.proofHash}</div>
      </div>
    </div>`;
};

function renderProofPanel() {
  const zkLoading = !state.zkEnabled && window.__zkDiag && window.__zkDiag.mode === "probing";
  const privacyNote = zkLoading
    ? `
    <div class="privacy-note is-loading">
      <div class="pn-icon" aria-hidden="true">⏳</div>
      <div class="pn-body">
        <h3>正在启用零知识加密…</h3>
        <p>Aleo 零知识引擎正在后台加载（约 21MB wasm，首次稍慢）。加载完成后船位将作为 ZK 程序的<strong>私有输入</strong>被加密保护，游戏可正常进行。</p>
      </div>
    </div>`
    : state.zkEnabled
      ? `
    <div class="privacy-note">
      <div class="pn-icon" aria-hidden="true">🔒</div>
      <div class="pn-body">
        <h3>船位零知识加密保护已启用</h3>
        <p>你的船位作为 ZK 程序的<strong>私有输入</strong>被加密保护——每一发命中/未中都由零知识证明验证，<strong>游戏过程中绝不向对手泄露</strong>船的位置。</p>
      </div>
    </div>`
      : `
    <div class="privacy-note is-fallback">
      <div class="pn-icon" aria-hidden="true">⚠</div>
      <div class="pn-body">
        <h3>本局未启用零知识加密（本地校验模式）</h3>
        <p>当前为本地降级模式，命中判定由本地计算得出，<strong>船位并未经过零知识加密保护</strong>。配置好 Aleo 网络后将自动启用。</p>
      </div>
    </div>`;

  const summary = state.zkEnabled
    ? "🔒 本回合命中已由零知识证明验证 — 点开看原始密码学数据"
    : "⚠ 当前为本地降级模式，未运行真·零知识证明 — 点开看日志";

  const logHtml = state.proofLog.length === 0
    ? '<div class="proof-empty">还没有生成证明，开火后会出现在这里。</div>'
    : state.proofLog.map(entry => `
    <div class="proof-entry ${entry.zkProof ? "zk-real" : "zk-fallback"}">
      <div class="proof-header">
        <span class="proof-func">${entry.function}()</span>
        <span class="proof-time">${entry.timestamp}</span>
        <span class="proof-engine engine-${entry.engine === 'WebGPU' ? 'gpu' : entry.engine === 'WASM' ? 'wasm' : 'js'}">${entry.engine}${entry.ms > 0 ? ' · ' + entry.ms + 'ms' : ''}</span>
        <span class="proof-badge ${entry.zkProof ? "badge-real" : "badge-fallback"}">
          ${entry.zkProof ? "✓ ZK PROOF" : "⚠ FALLBACK"}
        </span>
      </div>
      <div class="proof-details">
        <div class="proof-row"><span>ships (private):</span> <code>${entry.shipsHidden}</code></div>
        <div class="proof-row"><span>mask (public):</span> <code>${entry.publicInput}u32</code></div>
        <div class="proof-row"><span>result:</span> <code class="proof-result">${entry.result}</code></div>
        <div class="proof-row"><span>proof hash:</span> <code class="proof-hash">${entry.proofHash}</code></div>
      </div>
    </div>
  `).join("");

  return privacyNote + `
    <details class="proof-collapsible">
      <summary>${summary}</summary>
      <div class="proof-log">${logHtml}</div>
    </details>`;
}

function renderProofLog() {
  const panel = document.querySelector(".proof-panel");
  if (panel) panel.innerHTML = renderProofPanel();
}

// ===== BATTLE FEED (human-language combat log) =====
function addBattle(text, type = "sys") {
  state.battleLog.unshift({ text, type, time: new Date().toLocaleTimeString() });
  if (state.battleLog.length > 8) state.battleLog.pop();
}

function renderBattleFeed() {
  const list = state.battleLog.length
    ? state.battleLog.map(e => `
      <div class="battle-entry battle-${e.type}">
        <span class="battle-time">${e.time}</span>
        <span class="battle-text">${e.text}</span>
      </div>`).join("")
    : '<div class="battle-empty">放船开火后，这里会实时播报战况。</div>';
  return `
    <div class="battle-feed-head">
      <h3>⚔ 战斗实况 ${state.matchRound > 0 || state.matchWins > 0 || state.matchLosses > 0 ? `<span class="match-score">(${state.matchWins}:${state.matchLosses})</span>` : ""}</h3>
      <span class="battle-score">敌方舰剩 ${state.opponentShipsRemaining}/${TOTAL_SHIP_CELLS} · 我方舰剩 ${state.playerShipsRemaining}/${TOTAL_SHIP_CELLS}</span>
    </div>
    <div class="battle-list">${list}</div>`;
}

function renderGameOver() {
  const s = state.zkStats;
  const verifyRate = s.proofsGenerated > 0
    ? Math.round((s.proofsVerified / s.proofsGenerated) * 100)
    : 0;

  // Efficiency rating: fewer shots = more stars
  const efficiency = state.turnCount > 0 ? Math.round((TOTAL_SHIP_CELLS / state.turnCount) * 100) : 0;
  const stars = efficiency >= 80 ? "⭐⭐⭐" : efficiency >= 50 ? "⭐⭐" : efficiency >= 30 ? "⭐" : "";
  const ratingLabel = efficiency >= 80 ? "完美" : efficiency >= 50 ? "优秀" : efficiency >= 30 ? "及格" : "待提升";

  // Check if match is decided (best of 3)
  const matchDecided = state.matchWins >= 2 || state.matchLosses >= 2;
  const matchWon = state.matchWins >= 2;

  // Update match score on round end
  if (state.winner === "player" && !state.matchOver) {
    state.matchWins++;
    state.matchOver = matchDecided;
  } else if (state.winner === "opponent" && !state.matchOver) {
    state.matchLosses++;
    state.matchOver = matchDecided;
  }

  const matchScoreBar = `
    <div class="go-match-bar">
      <div class="go-match-side ${state.winner === "player" ? "is-win" : ""}">
        <span class="go-match-label">你</span>
        <span class="go-match-score">${state.matchWins}</span>
      </div>
      <div class="go-match-vs">VS (R${state.matchRound + 1})</div>
      <div class="go-match-side ${state.winner === "opponent" ? "is-win" : ""}">
        <span class="go-match-label">敌方</span>
        <span class="go-match-score">${state.matchLosses}</span>
      </div>
    </div>`;

  const matchResult = matchDecided
    ? `<div class="go-match-result ${matchWon ? "over-win" : "over-lose"}">${matchWon ? "🏆 系列赛胜利！" : "💀 系列赛落败"}</div>`
    : "";

  const actionBtn = matchDecided
    ? '<button class="restart-btn" onclick="window.restart()">返回主菜单</button>'
    : `<button class="restart-btn" onclick="window.nextRound()">下一局 →</button>
       <button class="restart-btn restart-btn--alt" onclick="window.restart()">放弃比赛</button>`;

  return `
    <div class="game-over-overlay">
      <div class="game-over-modal ${state.winner === "player" ? "over-win" : "over-lose"}">
        <h2>${state.winner === "player" ? "🏆 胜 利" : "💀 战 败"}</h2>
        <p>${state.winner === "player" ? "敌方舰队已被你全部击沉！" : "你的舰队全军覆没。"}</p>
        ${matchScoreBar}
        ${matchResult}
        <div class="go-efficiency">
          <span class="go-eff-stars">${stars}</span>
          <span class="go-eff-label">效率 ${ratingLabel}</span>
          <span class="go-eff-detail">${state.turnCount} 回合 / ${TOTAL_SHIP_CELLS} 命中</span>
        </div>
        <div class="go-blockchain-summary">
          <div class="go-bc-title">⛓ Blockchain Summary</div>
          <div class="go-bc-stats">
            <div class="go-bc-stat"><span class="go-bc-num">${s.proofsGenerated}</span><span class="go-bc-label">ZK Proofs</span></div>
            <div class="go-bc-stat"><span class="go-bc-num go-bc-num--green">${s.proofsVerified}</span><span class="go-bc-label">Verified</span></div>
            <div class="go-bc-stat"><span class="go-bc-num">${verifyRate}%</span><span class="go-bc-label">Verify Rate</span></div>
          </div>
          <div class="go-bc-program">
            <span class="go-bc-label">Program:</span>
            <code>shadowfleet.aleo</code>
          </div>
          <div class="go-bc-privacy">
            ${state.zkEnabled
              ? "🔒 本局所有命中判定均由 Aleo 零知识证明验证。船位作为私有输入全程加密，未曾泄露。"
              : "⚠ 本局运行在本地校验模式，未运行真·零知识证明。"}
          </div>
          ${state.achievements.length > 0 ? `
          <div class="go-achievements">
            <div class="go-ach-title">🏆 本局成就</div>
            <div class="go-ach-list">
              ${state.achievements.map(id => {
                const a = ACHIEVEMENTS[id];
                return a ? `<span class="go-ach-item">${a.icon} ${a.name}</span>` : "";
              }).join("")}
            </div>
          </div>` : ""}
          ${state.maxCombo >= 2 ? `<div class="go-combo">🔥 最高连击：x${state.maxCombo}</div>` : ""}
        </div>
        <div class="go-actions">${actionBtn}</div>
      </div>
    </div>
  `;
}

// ===== GLOBAL HANDLERS =====
window.placeShip = handlePlacementClick;
window.fireAt = playerFire;
window.toggleDir = togglePlacementDirection;
window.startGame = () => {
  sfx.init();
  sfx.click();
  // Apply fleet config
  SHIPS = FLEET_CONFIGS[state.fleetMode];
  TOTAL_SHIP_CELLS = SHIPS.reduce((s, ship) => s + ship.size, 0);
  // Reset match state for a new match
  state.matchWins = 0;
  state.matchLosses = 0;
  state.matchRound = 0;
  state.matchOver = false;
  state.phase = "placement";
  resetRoundState();
  render();
};
function resetRoundState() {
  playerShipGroups = [];
  opponentShipGroups = [];
  state.playerShips = 0;
  state.playerShots = 0;
  state.playerHits = 0;
  state.playerShipsRemaining = TOTAL_SHIP_CELLS;
  state.opponentShips = 0;
  state.opponentShots = 0;
  state.opponentHits = 0;
  state.opponentShipsRemaining = TOTAL_SHIP_CELLS;
  state.currentTurn = "player";
  state.winner = null;
  state.placingShipIndex = 0;
  state.placementDirection = "horizontal";
  state.proofLog = [];
  state.battleLog = [];
  state.zkStats = { proofsGenerated: 0, proofsVerified: 0, proofsFallback: 0, totalProofMs: 0 };
  state.combo = 0;
  state.maxCombo = 0;
  state.scanMode = false;
  state.scansRemaining = 1;
  state.achievements = [];
  state.turnCount = 0;
  resetAI();
}

window.restart = () => {
  sfx.click();
  fx.clear();
  inputLocked = false;
  // If match is over, go back to start screen
  if (state.matchOver) {
    state.phase = "start";
    state.matchOver = false;
    state.matchWins = 0;
    state.matchLosses = 0;
    state.matchRound = 0;
    render();
    return;
  }
  // Otherwise start next round
  state.phase = "placement";
  resetRoundState();
  render();
};

// Start next round in the match
window.nextRound = () => {
  sfx.click();
  fx.clear();
  inputLocked = false;
  state.matchRound++;
  state.phase = "placement";
  resetRoundState();
  render();
};

// ===== INITIALIZATION =====
// 静音开关挂到 <body>（不在 #app 内 → 不会被全量重渲染冲掉）。
// 这里只建 DOM，不碰 AudioContext，符合自动播放策略。
sfx.mountToggle();

// ===== WebGPU 初始化 =====
ZKGPU.init().then(ok => {
  if (ok) {
    state.gpuEnabled = true;
    console.log("[GPU] WebGPU 已启用，ZK 运算将使用 GPU 加速");
    render();
  } else {
    console.log("[GPU] WebGPU 不可用，使用 WASM/JS 回退");
  }
});

// ===== 状态桥接到 MCP =====
syncState(state);

// 打开即开始页，无需 loading 引导。ZK 引擎在后台异步加载，
// 就绪（或失败降级）由下方事件监听更新状态并局部刷新，不挡玩家。
if (window.__zkReady) {
  state.zkEnabled = true;
  state.aleoAddress = window.__zkAddress;
}
render();

window.addEventListener("zk-ready", () => {
  state.zkEnabled = true;
  state.aleoAddress = window.__zkAddress;
  render();
});

window.addEventListener("zk-error", () => {
  if (!state.zkEnabled) {
    state.zkEnabled = false;
    render();
  }
});
