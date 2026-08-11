// ===== Render functions — partial update support + accessibility =====

import { state, SHIPS, TOTAL_SHIP_CELLS } from "./state.js";
import { t, getShipName, getLang } from "./i18n.js";
import { SoundFX } from "./sound.js";

// --- render() is injected by main.js to avoid circular dep ---
let _render = null;
export function setRender(fn) { _render = fn; }

// ===== MAIN RENDER =====
export function render() {
  if (_render) return _render();
}

// ===== PARTIAL UPDATES (avoid full DOM rebuild) =====
export function renderHintBar() {
  const el = document.querySelector(".hint-bar");
  if (!el) return;
  el.innerHTML = getHintText();
}

export function renderStatusBarOnly() {
  const el = document.querySelector(".status-bar");
  if (!el) return;
  el.innerHTML = renderStatusBarInner();
}

export function renderStatsPanelOnly() {
  const el = document.querySelector(".stats-panel");
  if (!el) return;
  el.outerHTML = renderStatsPanel();
}

// ===== HINT HELPERS =====
export function getHintText() {
  if (!state.currentHint) return "";
  if (state.currentHint === "__custom__") return state._customHint || "";
  return t(state.currentHint);
}

export function updateHint(hintKey) {
  state.currentHint = hintKey;
  state._customHint = "";
}

export function setCustomHint(text) {
  state.currentHint = "__custom__";
  state._customHint = text;
}

// ===== RENDER: HOW TO PLAY =====
export function renderHowToPlay() {
  if (state.phase === "placement") {
    return `
      <div class="how-to-play">
        <h3 class="htp-title">${t("htpTitle")}</h3>
        <div class="htp-steps">
          <div class="htp-item"><span class="htp-num">1</span><span class="htp-text">${t("htp1")}</span></div>
          <div class="htp-item"><span class="htp-num">2</span><span class="htp-text">${t("htp2")}</span></div>
          <div class="htp-item"><span class="htp-num">3</span><span class="htp-text">${t("htp3")}</span></div>
        </div>
      </div>`;
  } else if (state.phase === "battle") {
    return `
      <div class="how-to-play">
        <h3 class="htp-title">${t("htpTitle")}</h3>
        <div class="htp-steps">
          <div class="htp-item"><span class="htp-num">1</span><span class="htp-text">${t("htpBattle1")}</span></div>
          <div class="htp-item"><span class="htp-num">2</span><span class="htp-text">${t("htpBattle2")}</span></div>
          <div class="htp-item"><span class="htp-num">3</span><span class="htp-text">${t("htpBattle3")}</span></div>
        </div>
      </div>`;
  } else if (state.phase === "gameover") {
    return `
      <div class="how-to-play">
        <h3 class="htp-title">${t("htpTitle")}</h3>
        <div class="htp-steps">
          <div class="htp-item"><span class="htp-num">1</span><span class="htp-text">${t("htpEnd1")}</span></div>
          <div class="htp-item"><span class="htp-num">2</span><span class="htp-text">${t("htpEnd2")}</span></div>
        </div>
      </div>`;
  }
  return "";
}

// ===== RENDER: SETTINGS PANEL =====
export function renderSettingsPanel() {
  return `
    <div class="settings-dropdown" role="dialog" aria-label="${t("settings")}">
      <div class="settings-dropdown-header">
        <span>${t("settings")}</span>
        <button class="settings-close" onclick="window.toggleSettings()" aria-label="${t("close")}">✕</button>
      </div>
      <div class="settings-section">
        <label class="settings-label">${t("language")}</label>
        <div class="lang-options" role="group" aria-label="${t("language")}">
          <button class="lang-option ${getLang() === "zh" ? "active" : ""}" onclick="window.setLang('zh')">${t("chinese")}</button>
          <button class="lang-option ${getLang() === "en" ? "active" : ""}" onclick="window.setLang('en')">${t("english")}</button>
        </div>
      </div>
      <div class="settings-section">
        <label class="settings-label">${t("soundOn")}</label>
        <button class="lang-option" onclick="window.toggleSound()">${SoundFX.enabled ? t("soundOn") : t("soundOff")}</button>
      </div>
    </div>`;
}

// ===== RENDER: MENU =====
export function renderMenu() {
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
          </div>` : ""}
      </div>
    </div>`;
}

// ===== RENDER: STATS PANEL =====
export function renderStatsPanel() {
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
      ${(state.phase === "battle" || state.phase === "gameover") ? `
        <div class="stats-extra">
          <div class="stat-extra-row"><span>🔥 ${t("maxCombo")}</span><span>${state.maxCombo}</span></div>
          <div class="stat-extra-row"><span>💀 ${t("sunk")}</span><span>${sunkNames}</span></div>
        </div>` : ""}
    </div>`;
}

// ===== RENDER: LOADING =====
export function renderLoading() {
  return `
    <div class="loading-screen">
      <div class="loading-spinner"></div>
      <h2>${t("initializing")}</h2>
      <p>${t("loadingDesc")}</p>
    </div>`;
}

// ===== RENDER: GRID =====
export function renderGrid(side) {
  let html = `<div class="grid" role="grid"><div class="grid-header"><div></div>`;
  for (let c = 0; c < 5; c++) {
    html += `<div class="grid-label">${String.fromCharCode(65 + c)}</div>`;
  }
  html += `</div>`;
  for (let r = 0; r < 5; r++) {
    html += `<div class="grid-row"><div class="grid-label">${r + 1}</div>`;
    for (let c = 0; c < 5; c++) {
      let cls = "cell";
      let content = "";
      const isPlayer = side === "player";
      const ships = isPlayer ? state.playerShips : state.opponentShips;
      const shots = isPlayer ? state.opponentShots : state.playerShots;
      const hits = isPlayer ? state.opponentHits : state.playerHits;

      if (shots & (1 << (r * 5 + c))) {
        if (hits & (1 << (r * 5 + c))) {
          cls += " cell-hit";
          content = "💥";
        } else {
          cls += " cell-miss";
          content = "🌊";
        }
      } else if (isPlayer && (ships & (1 << (r * 5 + c)))) {
        cls += " cell-ship";
        content = "🚢";
      } else {
        cls += " cell-water";
      }

      const clickable =
        (state.phase === "placement" && isPlayer) ||
        (state.phase === "battle" && !isPlayer && state.currentTurn === "player" && (state.scanMode || !(shots & (1 << (r * 5 + c)))));
      if (clickable) cls += " cell-clickable";
      if (state.scanMode && !isPlayer) cls += " cell-scan";

      const rowLabel = r + 1;
      const colLabel = String.fromCharCode(65 + c);
      const ariaLabel = `${colLabel}${rowLabel}`;

      if (clickable) {
        html += `<div class="${cls}" role="button" tabindex="0" aria-label="${ariaLabel}" onclick="window._cellClick(${isPlayer},${r},${c})" onkeydown="window._cellKey(event,${isPlayer},${r},${c})">${content}</div>`;
      } else {
        html += `<div class="${cls}" role="gridcell" aria-label="${ariaLabel}">${content}</div>`;
      }
    }
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

// ===== RENDER: STATUS BAR =====
export function renderStatusBarInner() {
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
    </div>`;
}

// ===== RENDER: PROOF PANEL =====
export function renderProofPanel() {
  const privacyNote = `
    <div class="privacy-note">
      <h3>${t("privacyTitle")}</h3>
      <p>${t("privacyDesc")}</p>
    </div>`;

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
    </div>`).join("");

  return privacyNote + `<div class="proof-log">${logHtml}</div>`;
}

export function renderProofLog() {
  const panel = document.querySelector(".proof-panel");
  if (panel) panel.innerHTML = renderProofPanel();
}

// ===== RENDER: GAME OVER =====
export function renderGameOver() {
  return `
    <div class="game-over-overlay" role="dialog" aria-modal="true">
      <div class="game-over-modal">
        <h2>${state.winner === "player" ? t("victoryTitle") : t("defeatTitle")}</h2>
        <p>${state.winner === "player" ? t("victoryDesc") : t("defeatDesc")}</p>
        <p class="proof-summary">${t("proofSummary")}</p>
        <button class="restart-btn" onclick="window.restart()" autofocus>${t("playAgain")}</button>
      </div>
    </div>`;
}

// ===== RENDER: HEADER =====
export function renderHeader() {
  return `
    <header class="game-header">
      <div class="settings-wrapper">
        <button class="settings-btn" onclick="window.toggleSettings()" aria-expanded="${state.settingsOpen}" aria-haspopup="true">${t("settings")}</button>
        ${state.settingsOpen ? renderSettingsPanel() : ""}
      </div>
      <h1>${t("title")} <span class="subtitle">${t("subtitle")}</span></h1>
      <p class="tagline">${t("tagline")}</p>
      <div class="header-links">
        <a href="https://github.com/cpufreestyle/zk-battleship-aleo" target="_blank" class="header-link">📖 GitHub</a>
        <a href="https://shadowfleet.vercel.app" target="_blank" class="header-link">🚀 Live Demo</a>
      </div>
    </header>`;
}

// ===== RENDER: BOARD SECTIONS =====
export function renderBoardSections() {
  return `
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
          </div>` : ""}
      </div>
    </div>`;
}
