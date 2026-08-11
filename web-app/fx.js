/**
 * fx.js — 隐海战舰 视觉特效层
 *
 * ============ 本文件要解决的核心技术难题 ============
 * main.js 的 render() 是「全量 innerHTML 重写」：
 *     document.querySelector("#app").innerHTML = `...`
 * 任何挂在格子上的 CSS 动画、任何插进棋盘里的特效节点，
 * 都会在下一次 render() 时被整体销毁 —— 动画一闪就没。
 *
 * 解法是三条，全部绕开「会被 innerHTML 冲掉」的区域：
 *
 * 1) 独立 overlay 层：#fx-layer 直接挂在 <body> 下，是 #app 的【兄弟节点】，
 *    不是子节点。render() 只改写 #app.innerHTML，永远碰不到它。
 *    所有爆炸/水波/锁定环/横幅都活在这一层，用 position:fixed +
 *    目标格子的 getBoundingClientRect() 对齐，视觉上「贴」在格子上，
 *    生命周期却完全独立。
 *
 * 2) 稳定宿主节点：屏幕震动加在 #app 自身而不是 .game-container 上。
 *    #app 这个元素本体在整个生命周期里从不被替换（只有它的 innerHTML 被换），
 *    所以 classList 上的动画类能挺过 render()。
 *
 * 3) 重定位而非重建：每个特效节点登记在 NODES 里并记住自己绑定的格子 key。
 *    render() 结束后 main.js 调 fx.afterRender()，遍历重新量一次
 *    getBoundingClientRect 并贴回去 —— 即使重渲染导致布局位移
 *    （比如战斗日志变长把棋盘顶下去），飞在空中的特效也会跟着走，
 *    而不是错位或残留。resize/scroll 同理。
 *
 * 所以特效不依赖 DOM 存活，只依赖「格子当前在屏幕上的位置」。
 * ==================================================
 */

/** 活跃特效节点登记表：{ el, cellKey, pad } */
const NODES = new Set();
let layer = null;
let shakeTimer = null;
let rafPending = false;

/** 格子标识：main.js 的 renderGrid() 会给每个格子打 data-cell="side-r-c" */
export function key(side, row, col) {
  return `${side}-${row}-${col}`;
}

function ensureLayer() {
  if (layer && layer.isConnected) return layer;
  layer = document.getElementById("fx-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "fx-layer";
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);
  }
  return layer;
}

function rectOf(cellKey) {
  const el = document.querySelector(`[data-cell="${cellKey}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  // 格子还没有布局（display:none 或未挂载）时不要生成特效
  if (r.width === 0 && r.height === 0) return null;
  return r;
}

function placeAt(el, rect, pad) {
  el.style.left = rect.left - pad + "px";
  el.style.top = rect.top - pad + "px";
  el.style.width = rect.width + pad * 2 + "px";
  el.style.height = rect.height + pad * 2 + "px";
}

/**
 * 生成一个绑定到某格子的特效节点。
 * @param {string} cellKey  data-cell 值
 * @param {string} cls      附加 class
 * @param {number} ttl      存活毫秒数，到点自动销毁并从登记表移除
 * @param {number} pad      向外扩张的像素（让爆炸能溢出格子边界）
 * @param {string} inner    可选内部 HTML（碎片等）
 */
function spawn(cellKey, cls, ttl, pad = 0, inner = "") {
  const rect = rectOf(cellKey);
  if (!rect) return null;

  const el = document.createElement("div");
  el.className = "fx-node " + cls;
  if (inner) el.innerHTML = inner;
  placeAt(el, rect, pad);
  ensureLayer().appendChild(el);

  const rec = { el, cellKey, pad };
  NODES.add(rec);
  setTimeout(() => {
    NODES.delete(rec);
    el.remove();
  }, ttl);

  return el;
}

/**
 * 重新测量所有活跃特效的宿主格子并贴回去。
 * render() 之后、窗口 resize/scroll 时调用。
 */
export function reposition() {
  if (NODES.size === 0) return;
  for (const rec of NODES) {
    const rect = rectOf(rec.cellKey);
    if (rect) placeAt(rec.el, rect, rec.pad);
  }
}

/** main.js 每次 render() 末尾调用 —— 特效跟随重渲染后的新布局 */
export function afterRender() {
  if (NODES.size === 0) return;
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    reposition();
  });
}

/* ---------- 具体特效 ---------- */

/** 锁定预备态：开火后、结果出来前的瞄准环，给出「已扣扳机」的确认感 */
export function lockOn(cellKey, ttl = 320) {
  spawn(
    cellKey,
    "fx-lock",
    ttl,
    4,
    '<i class="fx-lock-ring"></i><i class="fx-lock-cross"></i>'
  );
}

/** 命中爆炸：闪光 + 放射状碎片；big=击沉时再叠一圈冲击波 */
export function explode(cellKey, big = false) {
  spawn(cellKey, big ? "fx-blast fx-blast-big" : "fx-blast", big ? 900 : 620, big ? 16 : 9);

  const count = big ? 11 : 7;
  const spread = big ? 46 : 28;
  let shards = "";
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.55;
    const d = spread + Math.random() * (big ? 28 : 15);
    shards +=
      '<i class="fx-shard" style="--dx:' +
      (Math.cos(a) * d).toFixed(1) +
      "px;--dy:" +
      (Math.sin(a) * d).toFixed(1) +
      "px;--dly:" +
      (Math.random() * 70).toFixed(0) +
      'ms"></i>';
  }
  spawn(cellKey, "fx-shards", big ? 940 : 660, 0, shards);

  if (big) spawn(cellKey, "fx-ring", 900, 12);
}

/** 未中：双层水波扩散圈 */
export function ripple(cellKey) {
  spawn(cellKey, "fx-ripple", 820, 6, '<i></i><i class="fx-ripple-late"></i>');
}

/**
 * 屏幕震动。
 * 挂在 #app 上 —— 该元素本体不会被 render() 替换，动画类能存活。
 */
export function shake(level = "soft") {
  const app = document.querySelector("#app");
  if (!app) return;
  const cls = level === "hard" ? "fx-shake-hard" : "fx-shake";
  app.classList.remove("fx-shake", "fx-shake-hard");
  void app.offsetWidth; // 强制回流，保证同一个类能被连续重复触发
  app.classList.add(cls);
  clearTimeout(shakeTimer);
  shakeTimer = setTimeout(
    () => app.classList.remove("fx-shake", "fx-shake-hard"),
    level === "hard" ? 480 : 300
  );
}

/** 顶部横幅提示（来袭警报 / 击沉播报），同样活在 overlay 层 */
export function banner(text, variant = "warn", ttl = 900) {
  const el = document.createElement("div");
  el.className = "fx-banner fx-banner-" + variant;
  el.textContent = text;
  ensureLayer().appendChild(el);
  setTimeout(() => el.remove(), ttl);
}

/** 清空所有特效（重开一局时用） */
export function clear() {
  for (const rec of NODES) rec.el.remove();
  NODES.clear();
  const app = document.querySelector("#app");
  if (app) app.classList.remove("fx-shake", "fx-shake-hard");
  if (layer) layer.innerHTML = "";
}

window.addEventListener("resize", reposition, { passive: true });
window.addEventListener("scroll", reposition, { passive: true });
