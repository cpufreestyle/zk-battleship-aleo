/**
 * state-mcp.js — 轻量状态桥接层
 *
 * mcp.js 需要访问游戏状态，但 main.js 的 state 是模块内变量。
 * 用一个共享代理对象桥接：main.js 把真实 state 引用赋过来，
 * mcp.js 通过这个代理读取，始终拿到最新值（包括嵌套属性）。
 * 避免循环依赖 (main.js → mcp.js → state.js → main.js)。
 */

export const GRID_SIZE = 5;
export const TOTAL_SHIP_CELLS = 7;
export const SHIPS = [
  { size: 3, name: "Destroyer", cn: "驱逐舰" },
  { size: 2, name: "Frigate", cn: "护卫舰" },
  { size: 2, name: "Submarine", cn: "潜艇" },
];

// 代理对象 — _real 持有对 main.js state 的直接引用
// 所有属性通过 getter 代理读取，确保嵌套对象也是最新的
const _real = { state: null };

export const state = new Proxy({}, {
  get(_target, prop) {
    if (!_real.state) return undefined;
    return _real.state[prop];
  },
  ownKeys() {
    if (!_real.state) return [];
    return Reflect.ownKeys(_real.state);
  },
  getOwnPropertyDescriptor(_target, prop) {
    if (!_real.state) return undefined;
    const desc = Object.getOwnPropertyDescriptor(_real.state, prop);
    if (desc) {
      desc.configurable = true;
      return desc;
    }
    return undefined;
  },
});

/** main.js 调用此函数把自己的 state 引用桥接过来 */
export function syncState(realState) {
  _real.state = realState;
}
