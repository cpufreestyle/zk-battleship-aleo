/**
 * state-mcp.js — 轻量状态桥接层
 *
 * mcp.js 需要访问游戏状态，但 main.js 的 state 是模块内变量。
 * 用一个共享对象桥接：main.js 写入，mcp.js 读取。
 * 避免循环依赖 (main.js → mcp.js → state.js → main.js)。
 */

export const GRID_SIZE = 5;
export const TOTAL_SHIP_CELLS = 7;
export const SHIPS = [
  { size: 3, name: "Destroyer" },
  { size: 2, name: "Frigate" },
  { size: 2, name: "Submarine" },
];

// 共享状态对象 — main.js 会把真实 state 的引用赋过来
export const state = {
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
  proofLog: [],
  zkEnabled: false,
  combo: 0,
  difficulty: "normal",
  zkStats: { proofsGenerated: 0, proofsVerified: 0, proofsFallback: 0, totalProofMs: 0 },
  stats: { wins: 0, losses: 0, shots: 0, hits: 0, turns: 0 },
  // WebGPU 状态
  gpuEnabled: false,
  gpuMs: 0,
  cpuMs: 0,
};

/** main.js 调用此函数把自己的 state 桥接过来 */
export function syncState(realState) {
  // 直接把真实 state 的属性同步到共享对象
  for (const key of Object.keys(state)) {
    if (realState[key] !== undefined) {
      state[key] = realState[key];
    }
  }
}
