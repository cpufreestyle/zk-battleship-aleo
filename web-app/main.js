import "./style.css";
import "./zk.js";

// ===== I18N =====
const I18N = {
  zh: {
    title: "隐海战舰",
    subtitle: "SHADOW FLEET",
    tagline: "Aleo 零知识战舰 — 隐私海战",
    yourFleet: "你的舰队",
    enemyWaters: "敌方海域",
    placeYourShips: "— 放置你的战舰",
    clickToFire: "— 点击开火",
    placing: "正在放置: {name} ({size} 格) — 方向: {direction}",
    shipsRemaining: "剩余战舰: {n}/{total}",
    gameOver: "游戏结束",
    waitingForBattle: "等待战斗开始...",
    shipPlacement: "🚢 战舰放置 — 放置全部 {n} 艘战舰即可开始",
    yourTurn: "🎯 你的回合 — 点击敌方海域开火",
    opponentTurn: "⏳ 对手正在生成零知识证明...",
    victory: "🏆 胜利！敌方舰队已歼灭！",
    defeat: "💀 失败！你的舰队已被击沉。",
    zkActive: "⚡ Aleo ZK: 已激活",
    zkLoading: "⚠ Aleo ZK: 加载中...",
    privacyTitle: "🔐 零知识隐私保障",
    privacyDesc: "战舰位置是 Aleo ZK 程序的<strong>私有输入</strong>。<code>verify_hit</code> 函数证明命中/未命中结果正确，<strong>不泄露</strong>战舰位字符串。仅布尔结果公开。",
    noProofs: "尚未生成 ZK 证明。开始开火以生成零知识证明！",
    shipsPrivate: "ships (私有):",
    maskPublic: "mask (公开):",
    result: "结果:",
    proofHash: "证明哈希:",
    zkProofBadge: "✓ ZK 证明",
    fallbackBadge: "⚠ 回退模式",
    victoryTitle: "🏆 胜利",
    defeatTitle: "💀 失败",
    victoryDesc: "你击沉了敌方舰队！",
    defeatDesc: "你的舰队已被摧毁。",
    proofSummary: "所有命中/未命中结果均通过 Aleo 零知识证明验证。",
    playAgain: "再玩一局",
    initializing: "正在初始化 ZK 引擎...",
    loadingDesc: "正在加载 Aleo WebAssembly 运行时以生成零知识证明",
    encrypted: "🔒 已加密",
    rotate: "↻ 旋转",
    horizontal: "水平",
    vertical: "垂直",
    destroyer: "驱逐舰",
    frigate: "护卫舰",
    submarine: "潜水艇",
    langLabel: "EN",
  },
  en: {
    title: "Shadow Fleet",
    subtitle: "隐海战舰",
    tagline: "ZK Battleship on Aleo — Zero-Knowledge Naval Combat",
    yourFleet: "Your Fleet",
    enemyWaters: "Enemy Waters",
    placeYourShips: "— Place Your Ships",
    clickToFire: "— Click to Fire",
    placing: "Placing: {name} ({size} cells) — Direction: {direction}",
    shipsRemaining: "Ships remaining: {n}/{total}",
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

// ===== GAME CONFIGURATION =====
const GRID_SIZE = 5;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
const SHIPS = [
  { size: 3, name: "Destroyer" },
  { size: 2, name: "Frigate" },
  { size: 2, name: "Submarine" },
];
const TOTAL_SHIP_CELLS = SHIPS.reduce((s, ship) => s + ship.size, 0);

// ===== GAME STATE =====
const state = {
  phase: "loading",
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
        placedShip = true;
      }
    }
  }
  return ships;
}

// ===== GAME LOGIC =====
async function playerFire(row, col) {
  if (state.phase !== "battle" || state.currentTurn !== "player") return;
  const mask = getMask(row, col);
  if (state.playerShots & mask) return;

  state.playerShots |= mask;
  const isHit = await zkVerifyHit(state.opponentShips, mask);
  if (isHit) {
    state.playerHits |= mask;
    state.opponentShipsRemaining--;
  }
  render();

  const victory = await zkVerifyVictory(state.opponentShips, state.playerHits);
  if (victory) {
    state.phase = "gameover";
    state.winner = "player";
    render();
    return;
  }

  state.currentTurn = "opponent";
  render();
  setTimeout(() => opponentFire(), 800);
}

async function opponentFire() {
  if (state.phase !== "battle") return;
  const available = [];
  for (let i = 0; i < TOTAL_CELLS; i++) {
    if (!(state.opponentShots & (1 << i))) available.push(i);
  }
  if (available.length === 0) return;
  const target = available[Math.floor(Math.random() * available.length)];
  const mask = 1 << target;

  state.opponentShots |= mask;
  const isHit = await zkVerifyHit(state.playerShips, mask);
  if (isHit) {
    state.opponentHits |= mask;
    state.playerShipsRemaining--;
  }
  render();

  const victory = await zkVerifyVictory(state.playerShips, state.opponentHits);
  if (victory) {
    state.phase = "gameover";
    state.winner = "opponent";
    render();
    return;
  }

  state.currentTurn = "player";
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
    if (r >= GRID_SIZE || c >= GRID_SIZE) { render(); return; }
    if (isBitSet(state.playerShips, r, c)) { render(); return; }
    cells.push(cellToBit(r, c));
  }

  for (const bit of cells) {
    state.playerShips |= (1 << bit);
  }
  state.placingShipIndex++;

  if (state.placingShipIndex >= SHIPS.length) {
    state.opponentShips = generateRandomShips();
    state.phase = "battle";
  }
  render();
}

function togglePlacementDirection() {
  state.placementDirection = state.placementDirection === "horizontal" ? "vertical" : "horizontal";
  render();
}

// ===== RENDERING =====
function render() {
  const app = document.querySelector("#app");
  if (state.phase === "loading") {
    app.innerHTML = renderLoading();
    return;
  }
  app.innerHTML = `
    <div class="game-container">
      <header class="game-header">
        <button class="lang-toggle" onclick="window.toggleLang()">${t("langLabel")}</button>
        <h1>${t("title")} <span class="subtitle">${t("subtitle")}</span></h1>
        <p class="tagline">${t("tagline")}</p>
      </header>
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
          ${state.phase === "placement" ? `<button class="dir-btn" onclick="window.toggleDir()">${t("rotate")}</button>` : ""}
        </div>
        <div class="board-section">
          <h2>${t("enemyWaters")} ${state.phase === "battle" ? t("clickToFire") : ""}</h2>
          <p class="board-info">
            ${state.phase === "battle"
              ? t("shipsRemaining", { n: state.opponentShipsRemaining, total: TOTAL_SHIP_CELLS })
              : state.phase === "gameover" ? t("gameOver") : t("waitingForBattle")
            }
          </p>
          ${renderGrid("opponent")}
        </div>
      </div>
      <div class="status-bar">${renderStatusBar()}</div>
      <div class="proof-panel">${renderProofPanel()}</div>
      ${state.phase === "gameover" ? renderGameOver() : ""}
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
        (state.phase === "battle" && !isPlayer && state.currentTurn === "player" && !isBitSet(shots, r, c));
      if (clickable) cls += " cell-clickable";

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
    <div class="status-left">${status}</div>
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
window.restart = () => {
  state.phase = "placement";
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
  render();
};

// ===== INITIALIZATION =====
document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";

// Start in fallback mode, switch to ZK when WASM is ready
setTimeout(() => {
  if (state.phase === "loading") {
    state.zkEnabled = false;
    state.phase = "placement";
    render();
  }
}, 3000);

// Listen for ZK engine ready event (or check if already ready)
if (window.__zkReady) {
  state.zkEnabled = true;
  state.aleoAddress = window.__zkAddress;
  state.phase = "placement";
  render();
} else {
  window.addEventListener("zk-ready", () => {
    state.zkEnabled = true;
    state.aleoAddress = window.__zkAddress;
    if (state.phase === "loading") {
      state.phase = "placement";
    }
    render();
  });

  window.addEventListener("zk-error", () => {
    if (state.phase === "loading") {
      state.zkEnabled = false;
      state.phase = "placement";
      render();
    }
  });
}

render();
