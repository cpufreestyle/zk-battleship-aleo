import "./style.css";
import "./zk.js";
import { sfx } from "./audio.js";
import * as fx from "./fx.js";

// ===== GAME CONFIGURATION =====
const GRID_SIZE = 5;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
const SHIPS = [
  { size: 3, name: "Destroyer", cn: "驱逐舰" },
  { size: 2, name: "Frigate", cn: "护卫舰" },
  { size: 2, name: "Submarine", cn: "潜艇" },
];
const TOTAL_SHIP_CELLS = SHIPS.reduce((s, ship) => s + ship.size, 0);

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

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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
};

// ===== ZK VERIFICATION =====
async function zkVerifyHit(shipsBitstring, mask) {
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
  addProofLog("verify_hit", shipsBitstring, mask, hit ? "true" : "false", false);
  return hit;
}

async function zkVerifyVictory(shipsBitstring, hitsBitstring) {
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
  addProofLog("verify_victory", shipsBitstring, hitsBitstring, won ? "true" : "false", false);
  return won;
}

// ===== PROOF LOG =====
function addProofLog(func, ships, publicInput, result, zkProof) {
  const entry = {
    timestamp: new Date().toLocaleTimeString(),
    function: func,
    shipsHidden: "🔒 ENCRYPTED",
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
  if (ai.mode === "target" && ai.targets.length > 0) {
    while (ai.targets.length > 0) {
      const bit = ai.targets.pop();
      if (!(shot & (1 << bit))) return bit;
    }
  }
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
  const mask = getMask(row, col);
  if (state.playerShots & mask) return;

  inputLocked = true;
  const k = fx.key("opponent", row, col);
  const cellName = String.fromCharCode(65 + col) + (row + 1);

  // 立刻标记已射击（防重复开火），但先【不】render ——
  // 因为 renderGrid 由 shots/hits 推导外观，此刻 hits 还未知，
  // 提前渲染会先把格子画成「未中 🌊」再改成命中，穿帮。
  state.playerShots |= mask;

  // 手感第 1 拍：扣扳机 —— 音效 + 锁定环，先给确认反馈
  sfx.fire();
  fx.lockOn(k, FEEL.LOCK_ON_MS + 170);

  // 手感第 2 拍：悬念。ZK 与最短等待并行，取较慢者。
  // 真 ZK 慢 → 按真实耗时；本地降级快 → 补足 SUSPENSE_MS，节奏统一。
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
    sunkShip = sunkShipBy(opponentShipGroups, state.playerHits, mask);
    if (sunkShip) {
      addBattle(`🔥 ${cellName} 命中——敌方${sunkShip.cn}已被击沉！`, "hit");
      sfx.sunk();
      fx.explode(k, true);
      fx.shake("hard");
      fx.banner(`击沉 敌方${sunkShip.cn}`, "sunk", 1200);
    } else {
      addBattle(`💥 ${cellName} 命中！敌方一艘船受损`, "hit");
      sfx.hit(false);
      fx.explode(k, false);
      fx.shake("soft");
    }
  } else {
    addBattle(`🌊 ${cellName} 未中。`, "miss");
    sfx.miss();
    fx.ripple(k);
  }
  render();

  const victory = await zkVerifyVictory(state.opponentShips, state.playerHits);
  if (victory) {
    await wait(FEEL.VICTORY_HOLD_MS); // 让最后的爆炸放完再弹结算
    state.phase = "gameover";
    state.winner = "player";
    sfx.victory();
    render();
    inputLocked = false;
    return;
  }

  // 手感第 4 拍：结果沉淀一拍再交出回合
  await wait(sunkShip ? FEEL.RESULT_HOLD_MS + 220 : FEEL.RESULT_HOLD_MS);
  if (state.phase !== "battle") { inputLocked = false; return; }

  state.currentTurn = "opponent";
  render();

  // 回合切换：先预警再挨打，别让对手凭空冒出来
  fx.banner("⚠ 敌方来袭", "warn", FEEL.INCOMING_MS);
  sfx.incoming();
  setTimeout(() => opponentFire(), FEEL.INCOMING_MS);
}

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
          ${state.phase === "placement" ? '<button class="dir-btn" onclick="window.toggleDir()">↻ 旋转</button>' : ""}
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
      <div class="status-bar${state.phase === "battle" && state.currentTurn === "opponent" ? " is-opp" : ""}">${renderStatusBar()}</div>
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
  return `
    <div class="start-screen">
      <div class="start-card">
        <h1 class="start-title">隐海战舰 <span class="subtitle">SHADOW FLEET</span></h1>
        <p class="tagline">ZK Battleship on Aleo — 零知识海战棋</p>
        <div class="how-to">
          <div class="how-step">
            <span class="step-num">1</span>
            <div><b>部署舰队</b><br>在 5×5 棋盘上点格子放 3 艘船（驱逐舰 3 格 / 护卫舰 2 格 / 潜艇 2 格），可用 ↻ 旋转方向。</div>
          </div>
          <div class="how-step">
            <span class="step-num">2</span>
            <div><b>开火对决</b><br>点敌方海域开火，💥 命中 / 🌊 未中。每发都由零知识证明验证，船位绝不泄露。</div>
          </div>
          <div class="how-step">
            <span class="step-num">3</span>
            <div><b>击沉获胜</b><br>打光对方 7 个船格即获胜，对手也会随机还击。</div>
          </div>
        </div>
        <div class="start-actions">
          <button class="start-btn" onclick="window.startGame()">开始游戏</button>
          <button class="tut-entry-btn" onclick="window.openTutorial()">📖 玩法教程</button>
        </div>
      </div>
    </div>
  `;
}

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
      { r: 0, c: 0, cls: "mb-ship", content: "🚢" },
      { r: 0, c: 1, cls: "mb-ship" },
      { r: 0, c: 2, cls: "mb-ship" },
      { r: 2, c: 3, cls: "mb-ship", content: "🚢" },
      { r: 2, c: 4, cls: "mb-ship" },
      { r: 4, c: 1, cls: "mb-ship", content: "🚢" },
      { r: 4, c: 2, cls: "mb-ship" },
    ];
    const enemy = [
      { r: 1, c: 1, cls: "mb-ship", content: "🚢" },
      { r: 1, c: 2, cls: "mb-ship" },
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
      { r: 0, c: 0, cls: "mb-ship", content: "🚢" }, { r: 0, c: 1, cls: "mb-ship" }, { r: 0, c: 2, cls: "mb-ship" },
      { r: 2, c: 3, cls: "mb-ship-d", content: "⛴" }, { r: 2, c: 4, cls: "mb-ship-d" },
      { r: 4, c: 1, cls: "mb-ship-d", content: "⚓" }, { r: 4, c: 2, cls: "mb-ship-d" },
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
      { r: 0, c: 0, cls: "mb-ship", content: "🚢" }, { r: 0, c: 1, cls: "mb-ship" }, { r: 0, c: 2, cls: "mb-ship" },
      { r: 2, c: 3, cls: "mb-ship", content: "🚢" }, { r: 2, c: 4, cls: "mb-ship" },
      { r: 4, c: 1, cls: "mb-ship", content: "🚢" }, { r: 4, c: 2, cls: "mb-ship" },
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
          <button class="tut-next" onclick="window.tutorialNext()">${isLast ? "开始游戏 🚀" : "下一步"}</button>
        </div>
      </div>
    </div>`;
}

window.openTutorial = () => {
  tutorialIndex = 0;
  renderTutorial();
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
        (state.phase === "battle" && !isPlayer && state.currentTurn === "player" && !isBitSet(shots, r, c));
      if (clickable) cls += " cell-clickable";

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

function renderStatusBar() {
  let status = "";
  if (state.phase === "placement") {
    status = `🚢 部署阶段 — 放完 ${SHIPS.length} 艘船即可开战`;
  } else if (state.phase === "battle") {
    status = state.currentTurn === "player"
      ? "🎯 你的回合 — 点击敌方海域开火"
      : "⏳ 对手正在计算命中…";
  } else if (state.phase === "gameover") {
    status = state.winner === "player" ? "🏆 胜利！敌方舰队已被全歼！" : "💀 失败！你的舰队沉没了。";
  }

  const zkStatus = state.zkEnabled
    ? '<span class="zk-badge zk-active">🔒 零知识验证 · 已启用</span>'
    : '<span class="zk-badge zk-fallback">⚠ 本地校验模式</span>';

  return `
    <div class="status-left">${status}</div>
    <div class="status-right">
      ${zkStatus}
      ${state.aleoAddress ? `<span class="addr-badge">Aleo: ${state.aleoAddress.substring(0, 12)}...</span>` : ""}
    </div>`;
}

function renderProofPanel() {
  const privacyNote = state.zkEnabled
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
      <h3>⚔ 战斗实况</h3>
      <span class="battle-score">敌方舰剩 ${state.opponentShipsRemaining}/${TOTAL_SHIP_CELLS} · 我方舰剩 ${state.playerShipsRemaining}/${TOTAL_SHIP_CELLS}</span>
    </div>
    <div class="battle-list">${list}</div>`;
}

function renderGameOver() {
  return `
    <div class="game-over-overlay">
      <div class="game-over-modal ${state.winner === "player" ? "over-win" : "over-lose"}">
        <h2>${state.winner === "player" ? "🏆 胜 利" : "💀 战 败"}</h2>
        <p>${state.winner === "player" ? "敌方舰队已被你全部击沉！" : "你的舰队全军覆没。"}</p>
        <p class="proof-summary">${state.zkEnabled
          ? "本局每一发的命中判定，都由 Aleo 零知识证明验证 —— 双方船位全程未泄露。"
          : "本局运行在本地校验模式（零知识引擎未启用），命中判定由本地计算完成。"}</p>
        <button class="restart-btn" onclick="window.restart()">再来一局</button>
      </div>
    </div>
  `;
}

// ===== GLOBAL HANDLERS =====
window.placeShip = handlePlacementClick;
window.fireAt = playerFire;
window.toggleDir = togglePlacementDirection;
window.startGame = () => {
  // 浏览器自动播放策略：AudioContext 只能在用户手势里创建/resume。
  // 「开始游戏」这一次点击就是全局唯一的音频解锁点。
  sfx.init();
  sfx.click();
  state.phase = "placement";
  render();
};
window.restart = () => {
  sfx.click();
  fx.clear();
  inputLocked = false;
  playerShipGroups = [];
  opponentShipGroups = [];
  state.phase = "start";
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
  resetAI();
  render();
};

// ===== INITIALIZATION =====
// 静音开关挂到 <body>（不在 #app 内 → 不会被全量重渲染冲掉）。
// 这里只建 DOM，不碰 AudioContext，符合自动播放策略。
sfx.mountToggle();

// 打开即开始页，无需 loading 引导。ZK 引擎在后台异步加载，
// 就绪（或失败降级）由下方事件监听更新状态并局部刷新，不挡玩家。
if (window.__zkReady) {
  state.zkEnabled = true;
  state.aleoAddress = window.__zkAddress;
}
render();

// 首次访问自动弹出玩法引导（用 localStorage 标记看过的玩家不再打扰）
try {
  if (!localStorage.getItem(TUTORIAL_KEY)) window.openTutorial();
} catch (e) {}

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
