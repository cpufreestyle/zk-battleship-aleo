// ===== Game logic — fire lock, fixed generateRandomShips, simulated proofHash =====

import { state, SHIPS, TOTAL_SHIP_CELLS, GRID_SIZE, TOTAL_CELLS, setFleet, saveStats } from "./state.js";
import { t, getShipName } from "./i18n.js";
import { SoundFX } from "./sound.js";
import { render, renderProofLog, updateHint, setCustomHint, getHintText } from "./render.js";

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

async function zkScanArea(shipsBitstring, scanMask) {
  if (state.zkEnabled && window.__zkExecute) {
    try {
      const result = await window.__zkExecute("verify_scan", [`${shipsBitstring}u32`, `${scanMask}u32`]);
      const val = parseInt(result[0]);
      // ZK returns (ships & scanMask) bitmask; count set bits for the scan result
      let count = 0, tmp = val;
      while (tmp) { count += tmp & 1; tmp >>= 1; }
      addProofLog("verify_scan", shipsBitstring, scanMask, String(count), true);
      return count;
    } catch (e) {
      console.warn("Aleo ZK scan failed, using JS fallback:", e.message);
      state.zkEnabled = false;
    }
  }
  const result = shipsBitstring & scanMask;
  let count = 0, tmp = result;
  while (tmp) { count += tmp & 1; tmp >>= 1; }
  addProofLog("verify_scan", shipsBitstring, scanMask, String(count), false);
  return count;
}

// ===== PROOF LOG — proofHash marked as simulated =====
function addProofLog(func, ships, publicInput, result, zkProof) {
  const entry = {
    timestamp: new Date().toLocaleTimeString(),
    function: func,
    shipsHidden: t("encrypted"),
    publicInput: publicInput,
    result: result,
    zkProof: zkProof,
    proofHash: zkProof
      ? "[sim] 0x" + Math.random().toString(16).substring(2, 10) + "..." + Math.random().toString(16).substring(2, 6)
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

// ===== SHIP PLACEMENT — returns { ships, shipList } instead of using window global =====
export function generateRandomShips() {
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
        shipList.push({ name: ship.name, size: ship.size, cells, sunk: false });
        placedShip = true;
      }
    }
  }
  return { ships, shipList };
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
  showAchievementPopup(t(key));
}

let achievementTimeout = null;
function showAchievementPopup(text) {
  let popup = document.querySelector(".achievement-popup");
  if (!popup) {
    popup = document.createElement("div");
    popup.className = "achievement-popup";
    popup.setAttribute("role", "alert");
    document.body.appendChild(popup);
  }
  popup.textContent = text;
  popup.classList.add("show");
  if (achievementTimeout) clearTimeout(achievementTimeout);
  achievementTimeout = setTimeout(() => popup.classList.remove("show"), 3500);
}

// ===== GAME LOGIC — with fire lock =====
export async function playerFire(row, col) {
  if (state.phase !== "battle" || state.currentTurn !== "player") return;
  if (state.firing) return; // Prevent concurrent clicks during async ZK proof

  if (state.scanMode) {
    return playerScan(row, col);
  }

  const mask = getMask(row, col);
  if (state.playerShots & mask) return;

  state.firing = true;
  try {
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

      const sunkShips = checkShipSunk(state.opponentShipsList, state.playerHits);
      if (sunkShips.length > 0) {
        for (const s of sunkShips) {
          state.sunkShips.push(s.name);
          setCustomHint(t("shipSunk", { name: getShipName(s), cells: String(s.size) }));
        }
        SoundFX.beep(150, 0.4, "square", 0.15);
      } else if (state.combo >= 5) {
        unlockAchievement("achCombo5");
        setCustomHint(t("combo", { n: String(state.combo) }));
      } else if (state.combo >= 3) {
        unlockAchievement("achCombo3");
        setCustomHint(t("combo", { n: String(state.combo) }));
      } else {
        setCustomHint(t("combo", { n: String(state.combo) }));
      }

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
      if (state.playerShipsRemaining === TOTAL_SHIP_CELLS) unlockAchievement("achPerfect");
      if (state.stats.shots === state.stats.hits) unlockAchievement("achFlawless");
      saveStats(true);
      updateHint("hintVictory");
      SoundFX.victory();
      render();
      return;
    }

    if (isHit) {
      render(); // Keep firing — combo
    } else {
      state.currentTurn = "opponent";
      updateHint("hintBattleOpponent");
      render();
      setTimeout(() => opponentFire(), 800);
    }
  } finally {
    state.firing = false;
  }
}

export async function opponentFire() {
  if (state.phase !== "battle") return;

  let target = -1;

  if (state.difficulty === "easy") {
    const available = getAvailableCells(state.opponentShots);
    if (available.length === 0) return;
    target = available[Math.floor(Math.random() * available.length)];
  } else if (state.difficulty === "normal") {
    const adjacent = getAdjacentToHits(state.opponentHits, state.opponentShots);
    if (adjacent.length > 0) {
      target = adjacent[Math.floor(Math.random() * adjacent.length)];
    } else {
      const available = getAvailableCells(state.opponentShots);
      if (available.length === 0) return;
      target = available[Math.floor(Math.random() * available.length)];
    }
  } else {
    const adjacent = getAdjacentToHits(state.opponentHits, state.opponentShots);
    if (adjacent.length > 0) {
      target = adjacent[Math.floor(Math.random() * adjacent.length)];
    } else {
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
    const sunkShips = checkShipSunk(state.playerShipsList, state.opponentHits);
    if (sunkShips.length > 0) {
      for (const s of sunkShips) {
        setCustomHint(t("shipSunkOpponent", { name: getShipName(s) }));
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
    saveStats(true);
    updateHint("hintDefeat");
    SoundFX.defeat();
    render();
    return;
  }

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

// ===== ZK RADAR SCAN =====
async function playerScan(row, col) {
  state.scanMode = false;
  state.scansRemaining = 0;
  const scanMask = build3x3Mask(row, col);
  SoundFX.scan();
  const count = await zkScanArea(state.opponentShips, scanMask);
  setCustomHint(t("hintScanResult", { n: String(count) }));
  render();
}

// ===== SHIP PLACEMENT UI =====
export function handlePlacementClick(row, col) {
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
  state.playerShipsList.push({ name: ship.name, size: ship.size, cells, sunk: false });
  state.placingShipIndex++;
  SoundFX.place();

  if (state.placingShipIndex >= SHIPS.length) {
    const result = generateRandomShips();
    state.opponentShips = result.ships;
    state.opponentShipsList = result.shipList;
    state.phase = "battle";
    updateHint("hintBattleStart");
  } else if (state.placingShipIndex === 1) {
    updateHint("hintPlace2");
  } else if (state.placingShipIndex === 2) {
    updateHint("hintPlace3");
  }
  render();
}

export function togglePlacementDirection() {
  state.placementDirection = state.placementDirection === "horizontal" ? "vertical" : "horizontal";
  render();
}

export function randomPlacement() {
  if (state.phase !== "placement") return;
  const playerResult = generateRandomShips();
  state.playerShips = playerResult.ships;
  state.playerShipsList = playerResult.shipList;
  state.placingShipIndex = SHIPS.length;
  const oppResult = generateRandomShips();
  state.opponentShips = oppResult.ships;
  state.opponentShipsList = oppResult.shipList;
  state.phase = "battle";
  updateHint("hintBattleStart");
  SoundFX.place();
  render();
}

export function activateScan() {
  if (state.scansRemaining <= 0 || state.scanMode) return;
  state.scanMode = true;
  updateHint("hintScan");
  render();
}

// ===== GAME SETUP =====
export function selectGame(difficulty, fleetSize) {
  state.difficulty = difficulty;
  state.fleetSize = fleetSize;
  setFleet(fleetSize);
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
  state.playerShips = 0;
  state.playerShots = 0;
  state.playerHits = 0;
  state.opponentShips = 0;
  state.opponentShots = 0;
  state.opponentHits = 0;
  state.phase = "placement";
  state.placingShipIndex = 0;
  state.placementDirection = "horizontal";
  state.proofLog = [];
  state.currentHint = "";
  state._customHint = "";
  updateHint("hintPlace1");
  render();
}

export function restart() {
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
  state._customHint = "";
  state.firing = false;
  render();
}
