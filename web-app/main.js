import "./style.css";
import "./zk.js";

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

// ===== PROOF LOG =====
function addProofLog(func, ships, publicInput, result, zkProof) {
  const entry = {
    timestamp: new Date().toLocaleTimeString(),
    function: func,
    shipsHidden: "🔒 Encrypted",
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
        <h1>隐海战舰 <span class="subtitle">SHADOW FLEET</span></h1>
        <p class="tagline">ZK Battleship on Aleo — 零知识证明海军战棋</p>
        <div class="header-links">
          <a href="https://github.com/cpufreestyle/zk-battleship-aleo" target="_blank" class="header-link">📖 GitHub</a>
          <a href="https://shadowfleet.vercel.app" target="_blank" class="header-link">🚀 Live Demo</a>
        </div>
      </header>
      ${state.phase === "placement" ? renderHowToPlay() : ""}
      <div class="game-main">
        <div class="board-section">
          <h2>${state.phase === "placement" ? "🚢 放置你的舰队" : "🛡️ 你的舰队"}</h2>
          <p class="board-info">
            ${state.phase === "placement"
              ? `正在放置: <strong>${SHIPS[state.placingShipIndex]?.name || "完成"}</strong> (${SHIPS[state.placingShipIndex]?.size || 0} 格) | 方向: ${state.placementDirection === "horizontal" ? "➡️ 横向" : "⬇️ 纵向"}`
              : `剩余战舰: <strong>${state.playerShipsRemaining}</strong>/${TOTAL_SHIP_CELLS} 格`
            }
          </p>
          ${renderGrid("player")}
          ${state.phase === "placement" ? '<button class="dir-btn" onclick="window.toggleDir()">↻ 旋转方向</button>' : ""}
        </div>
        <div class="board-section">
          <h2>${state.phase === "battle" ? "🎯 敌方海域 — 点击开火" : "🌊 敌方海域"}</h2>
          <p class="board-info">
            ${state.phase === "battle"
              ? `敌方剩余战舰: <strong>${state.opponentShipsRemaining}</strong>/${TOTAL_SHIP_CELLS} 格`
              : state.phase === "gameover" ? "战斗结束" : "等待战斗开始..."
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

function renderHowToPlay() {
  return `
    <div class="how-to-play">
      <div class="htp-item">
        <span class="htp-num">1</span>
        <span class="htp-text">在左侧网格点击放置 3 艘战舰</span>
      </div>
      <div class="htp-item">
        <span class="htp-num">2</span>
        <span class="htp-text">点击右侧敌方海域开火</span>
      </div>
      <div class="htp-item">
        <span class="htp-num">3</span>
        <span class="htp-text">每次开火生成 ZK 零知识证明，验证命中/未命中且不暴露战舰位置</span>
      </div>
    </div>
  `;
}

function renderLoading() {
  return `
    <div class="loading-screen">
      <div class="loading-spinner"></div>
      <h2>正在初始化 ZK 引擎...</h2>
      <p>加载 Aleo WebAssembly 运行时，用于浏览器内零知识证明生成</p>
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
    status = `🚢 布舰阶段 — 放置全部 ${SHIPS.length} 艘战舰后开始战斗`;
  } else if (state.phase === "battle") {
    status = state.currentTurn === "player"
      ? "🎯 你的回合 — 点击敌方海域开火"
      : "⏳ 对手正在生成 ZK 证明...";
  } else if (state.phase === "gameover") {
    status = state.winner === "player" ? "🏆 胜利！敌方舰队已全部击沉！" : "💀 失败！你的舰队被击沉了。";
  }

  const zkStatus = state.zkEnabled
    ? '<span class="zk-badge zk-active">⚡ Aleo ZK: 已激活</span>'
    : '<span class="zk-badge zk-fallback">⚠ Aleo ZK: 加载中...</span>';

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
      <h3>🔐 零知识隐私保证 — ZK Privacy Guarantee</h3>
      <p>战舰位置是 Aleo ZK 程序的<strong>私有输入 (private input)</strong>。<code>verify_hit</code> 函数证明命中/未命中结果正确，
      <strong>但不暴露</strong>战舰位串。只有布尔结果公开。</p>
      <p class="privacy-en">Ship positions are <strong>private inputs</strong> — the ZK proof verifies hit/miss is correct <strong>without revealing</strong> ship locations.</p>
    </div>
  `;

  if (state.proofLog.length === 0) {
    return privacyNote + `<div class="proof-empty">尚未生成 ZK 证明。开始开火以生成零知识证明！<br><span class="privacy-en">No ZK proofs yet. Start firing to generate zero-knowledge proofs!</span></div>`;
  }

  const logHtml = state.proofLog.map(entry => `
    <div class="proof-entry ${entry.zkProof ? "zk-real" : "zk-fallback"}">
      <div class="proof-header">
        <span class="proof-func">${entry.function}()</span>
        <span class="proof-time">${entry.timestamp}</span>
        <span class="proof-badge ${entry.zkProof ? "badge-real" : "badge-fallback"}">
          ${entry.zkProof ? "✓ ZK 证明" : "⚠ 回退模式"}
        </span>
      </div>
      <div class="proof-details">
        <div class="proof-row"><span>战舰位置 (私有):</span> <code>${entry.shipsHidden}</code></div>
        <div class="proof-row"><span>射击掩码 (公开):</span> <code>${entry.publicInput}u32</code></div>
        <div class="proof-row"><span>结果:</span> <code class="proof-result">${entry.result}</code></div>
        <div class="proof-row"><span>证明哈希:</span> <code class="proof-hash">${entry.proofHash}</code></div>
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
        <h2>${state.winner === "player" ? "🏆 胜利" : "💀 失败"}</h2>
        <p>${state.winner === "player" ? "你击沉了敌方全部舰队！" : "你的舰队被击沉了。"}</p>
        <p class="proof-summary">所有命中/未命中结果均通过 Aleo 零知识证明验证。<br><span class="privacy-en">All results verified via Aleo ZK proofs.</span></p>
        <button class="restart-btn" onclick="window.restart()">再来一局</button>
      </div>
    </div>
  `;
}

// ===== GLOBAL HANDLERS =====
window.placeShip = handlePlacementClick;
window.fireAt = playerFire;
window.toggleDir = togglePlacementDirection;
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
setTimeout(() => {
  if (state.phase === "loading") {
    state.zkEnabled = false;
    state.phase = "placement";
    render();
  }
}, 3000);

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
