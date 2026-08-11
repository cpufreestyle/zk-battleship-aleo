// ===== Shared game state, config, and stats =====

export const GRID_SIZE = 5;
export const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

export const FLEET_CONFIGS = {
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

export let SHIPS = FLEET_CONFIGS.small;
export let TOTAL_SHIP_CELLS = SHIPS.reduce((s, ship) => s + ship.size, 0);

export function setFleet(fleetSize) {
  SHIPS = FLEET_CONFIGS[fleetSize];
  TOTAL_SHIP_CELLS = SHIPS.reduce((s, ship) => s + ship.size, 0);
}

export const state = {
  phase: "loading",
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
  _customHint: "",
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
  firing: false, // async fire lock
};

// ===== Debounced stats persistence =====
let _statsTimer = null;

export function saveStats(immediate = false) {
  state.stats.turns = state.currentTurns;
  if (immediate) {
    localStorage.setItem("stats", JSON.stringify(state.stats));
    return;
  }
  if (_statsTimer) clearTimeout(_statsTimer);
  _statsTimer = setTimeout(() => {
    localStorage.setItem("stats", JSON.stringify(state.stats));
  }, 500);
}
