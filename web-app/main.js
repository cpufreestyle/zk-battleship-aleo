import "./style.css";
import "./zk.js";

import { getLang, setLangValue, t } from "./i18n.js";
import { SoundFX } from "./sound.js";
import { state } from "./state.js";
import {
  renderHeader, renderHowToPlay, renderBoardSections,
  renderStatusBarInner, renderStatsPanel, renderProofPanel,
  renderProofLog, renderMenu, renderLoading, renderGameOver,
  getHintText, setRender,
} from "./render.js";
import {
  playerFire, opponentFire, handlePlacementClick,
  togglePlacementDirection, randomPlacement, activateScan,
  selectGame, restart,
} from "./game.js";

// ===== MAIN RENDER (injected into render.js) =====
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
      ${renderHeader()}
      ${renderHowToPlay()}
      ${state.currentHint ? `<div class="hint-bar" role="status" aria-live="polite">${getHintText()}</div>` : ""}
      ${renderBoardSections()}
      <div class="status-bar">${renderStatusBarInner()}</div>
      ${renderStatsPanel()}
      <div class="proof-panel">${renderProofPanel()}</div>
      ${state.phase === "gameover" ? renderGameOver() : ""}
    </div>`;
}
setRender(render);

// ===== LANGUAGE / SETTINGS =====
function toggleLang() {
  setLangValue(getLang() === "zh" ? "en" : "zh");
  render();
}

function setLang(lang) {
  setLangValue(lang);
  state.settingsOpen = false;
  render();
}

function toggleSettings() {
  state.settingsOpen = !state.settingsOpen;
  render();
}

// ===== CELL CLICK / KEYBOARD HANDLER (accessibility) =====
function cellClick(isPlayer, r, c) {
  SoundFX.initOnGesture();
  if (isPlayer) {
    handlePlacementClick(r, c);
  } else {
    playerFire(r, c);
  }
}

function cellKey(event, isPlayer, r, c) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    cellClick(isPlayer, r, c);
  }
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
window.selectGame = selectGame;
window.restart = restart;
window.toggleSound = () => { SoundFX.initOnGesture(); const on = SoundFX.toggle(); render(); };
window._cellClick = cellClick;
window._cellKey = cellKey;

// ===== INITIALIZATION =====
document.documentElement.lang = getLang() === "zh" ? "zh-CN" : "en";

// Initialize SoundFX on first user interaction (any click or keydown)
document.addEventListener("click", () => SoundFX.initOnGesture(), { once: true });
document.addEventListener("keydown", () => SoundFX.initOnGesture(), { once: true });

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
