/**
 * audio.js — 隐海战舰 合成音效层（WebAudio API，零音频文件）
 *
 * 设计约束：
 *  1. 浏览器自动播放策略：AudioContext 必须在「用户手势」之后才能创建/resume。
 *     本模块在 import 阶段【不创建】任何 AudioContext，只有 sfx.init() 被调用
 *     时才创建 —— init() 由「开始游戏」按钮点击触发。
 *  2. 所有音色都是 OscillatorNode + 白噪声 buffer 程序化合成，不加载任何音频文件。
 *  3. 静音开关状态持久化到 localStorage，按钮挂到 <body> 上（不在 #app 内），
 *     因此不会被 main.js 的 innerHTML 全量重渲染冲掉。
 *
 * 输出链路： 各音色 → master(GainNode) → compressor → destination
 * 加压缩器是为了防止爆炸音 + 冲击低频叠加时削顶爆音。
 */

const STORAGE_KEY = "shadowfleet.muted";

let ctx = null;
let master = null;
let noiseBuf = null;
let muted = readMuted();

/* ---------- 静音状态持久化 ---------- */

function readMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch (_) {
    return false;
  }
}

function writeMuted(v) {
  try {
    localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
  } catch (_) {
    /* 隐私模式下 localStorage 可能抛异常，忽略即可 */
  }
}

/* ---------- 初始化（必须在用户手势内调用） ---------- */

function makeNoiseBuffer(seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function init() {
  if (ctx) {
    resume();
    return ctx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;

  try {
    ctx = new AC();
  } catch (e) {
    console.warn("[sfx] AudioContext 创建失败，游戏静音运行：", e && e.message);
    return null;
  }

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 24;
  comp.ratio.value = 10;
  comp.attack.value = 0.003;
  comp.release.value = 0.22;

  master = ctx.createGain();
  master.gain.value = muted ? 0.0001 : 0.85;

  master.connect(comp);
  comp.connect(ctx.destination);

  noiseBuf = makeNoiseBuffer(1.5);

  resume();
  return ctx;
}

function resume() {
  if (ctx && ctx.state === "suspended") {
    const p = ctx.resume();
    if (p && p.catch) p.catch(() => {});
  }
}

/** 每个音色的入口守卫：没初始化 / 静音 / 上下文没跑起来 → 直接放弃 */
function begin() {
  if (!ctx || muted) return null;
  if (ctx.state === "suspended") resume();
  return ctx.currentTime;
}

/* ---------- 合成原语 ---------- */

function osc(type, freq) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  return o;
}

function noise() {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.playbackRate.value = 0.85 + Math.random() * 0.3; // 每次略有差异，避免机械重复
  return s;
}

function gainNode() {
  const g = ctx.createGain();
  g.gain.value = 0.0001;
  return g;
}

function filter(type, freq, q) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  if (q != null) f.Q.value = q;
  return f;
}

/**
 * 冲击型包络：0 → peak（attack）→ 近 0（decay）
 * 用 exponentialRamp 因为听感上比线性自然，但目标值不能为 0，故收到 0.0001。
 */
function punch(g, t, peak, attack, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

/* ---------- 音色 ---------- */

/** 开火：发射的「咻」——频率快速下滑 + 一层气流噪声 */
function fire() {
  const t = begin();
  if (t === null) return;

  const o = osc("sawtooth", 900);
  o.frequency.setValueAtTime(920, t);
  o.frequency.exponentialRampToValueAtTime(165, t + 0.26);

  const lp = filter("lowpass", 3200);
  lp.frequency.setValueAtTime(3400, t);
  lp.frequency.exponentialRampToValueAtTime(620, t + 0.26);

  const g = gainNode();
  punch(g, t, 0.26, 0.012, 0.27);

  o.connect(lp);
  lp.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + 0.32);

  const n = noise();
  const bp = filter("bandpass", 2300, 1.1);
  const ng = gainNode();
  punch(ng, t, 0.085, 0.02, 0.2);
  n.connect(bp);
  bp.connect(ng);
  ng.connect(master);
  n.start(t);
  n.stop(t + 0.26);
}

/** 命中爆炸：白噪声爆破（低通下扫）+ 低频冲击 sub */
function hit(big) {
  const t = begin();
  if (t === null) return;

  const dur = big ? 0.85 : 0.5;

  // 爆破体：白噪声穿过一个从亮到闷的低通
  const n = noise();
  const lp = filter("lowpass", 3400);
  lp.frequency.setValueAtTime(big ? 4200 : 3200, t);
  lp.frequency.exponentialRampToValueAtTime(big ? 130 : 190, t + dur);
  const ng = gainNode();
  punch(ng, t, big ? 0.62 : 0.44, 0.006, dur);
  n.connect(lp);
  lp.connect(ng);
  ng.connect(master);
  n.start(t);
  n.stop(t + dur + 0.05);

  // 冲击低频：胸口那一下
  const sub = osc("sine", 150);
  sub.frequency.setValueAtTime(big ? 170 : 145, t);
  sub.frequency.exponentialRampToValueAtTime(big ? 34 : 46, t + (big ? 0.55 : 0.38));
  const sg = gainNode();
  punch(sg, t, big ? 0.58 : 0.42, 0.008, big ? 0.6 : 0.4);
  sub.connect(sg);
  sg.connect(master);
  sub.start(t);
  sub.stop(t + dur + 0.05);

  // 碎裂高频点缀
  const crack = noise();
  const hp = filter("highpass", 2600);
  const cg = gainNode();
  punch(cg, t, big ? 0.2 : 0.13, 0.004, 0.14);
  crack.connect(hp);
  hp.connect(cg);
  cg.connect(master);
  crack.start(t);
  crack.stop(t + 0.2);
}

/** 落水：短促水花 —— 带通白噪声 + 一个小「咚」 */
function miss() {
  const t = begin();
  if (t === null) return;

  const n = noise();
  const bp = filter("bandpass", 1500, 1.6);
  bp.frequency.setValueAtTime(2100, t);
  bp.frequency.exponentialRampToValueAtTime(700, t + 0.19);
  const ng = gainNode();
  punch(ng, t, 0.3, 0.006, 0.2);
  n.connect(bp);
  bp.connect(ng);
  ng.connect(master);
  n.start(t);
  n.stop(t + 0.24);

  const plop = osc("sine", 420);
  plop.frequency.setValueAtTime(430, t);
  plop.frequency.exponentialRampToValueAtTime(165, t + 0.13);
  const pg = gainNode();
  punch(pg, t, 0.2, 0.008, 0.14);
  plop.connect(pg);
  pg.connect(master);
  plop.start(t);
  plop.stop(t + 0.2);
}

/** 击沉：更重的爆炸 + 金属呻吟下沉音 */
function sunk() {
  const t = begin();
  if (t === null) return;

  hit(true);

  // 下沉：两个失谐锯齿一起往下掉，过低通做出「钢铁被水吞掉」的闷感
  const lp = filter("lowpass", 900);
  lp.frequency.setValueAtTime(1100, t + 0.1);
  lp.frequency.exponentialRampToValueAtTime(230, t + 1.15);
  const g = gainNode();
  g.gain.setValueAtTime(0.0001, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.26, t + 0.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  lp.connect(g);
  g.connect(master);

  [0, 7].forEach((detune, i) => {
    const o = osc(i === 0 ? "sawtooth" : "triangle", 240);
    o.detune.value = detune;
    o.frequency.setValueAtTime(235, t + 0.08);
    o.frequency.exponentialRampToValueAtTime(52, t + 1.15);
    o.connect(lp);
    o.start(t + 0.08);
    o.stop(t + 1.25);
  });
}

/** 放船：清脆的两声确认 */
function place() {
  const t = begin();
  if (t === null) return;

  [[620, 0], [935, 0.075]].forEach(([f, off]) => {
    const o = osc("sine", f);
    const g = gainNode();
    punch(g, t + off, 0.24, 0.006, 0.1);
    o.connect(g);
    g.connect(master);
    o.start(t + off);
    o.stop(t + off + 0.16);
  });
}

/** 非法放置 / 无效操作：低沉短促的拒绝音 */
function deny() {
  const t = begin();
  if (t === null) return;

  const o = osc("square", 165);
  o.frequency.setValueAtTime(170, t);
  o.frequency.exponentialRampToValueAtTime(96, t + 0.16);
  const lp = filter("lowpass", 900);
  const g = gainNode();
  punch(g, t, 0.18, 0.006, 0.17);
  o.connect(lp);
  lp.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + 0.22);
}

/** UI 点击：极短的一下 tick */
function click() {
  const t = begin();
  if (t === null) return;

  const o = osc("triangle", 1150);
  const g = gainNode();
  punch(g, t, 0.14, 0.003, 0.045);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + 0.07);
}

/** 敌方来袭警报：两声下压的短促蜂鸣 */
function incoming() {
  const t = begin();
  if (t === null) return;

  [0, 0.17].forEach((off) => {
    const o = osc("sawtooth", 360);
    o.frequency.setValueAtTime(380, t + off);
    o.frequency.linearRampToValueAtTime(300, t + off + 0.1);
    const lp = filter("lowpass", 1400);
    const g = gainNode();
    punch(g, t + off, 0.16, 0.012, 0.1);
    o.connect(lp);
    lp.connect(g);
    g.connect(master);
    o.start(t + off);
    o.stop(t + off + 0.15);
  });
}

/** 胜利：上行大三和弦琶音 */
function victory() {
  const t = begin();
  if (t === null) return;

  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const off = i * 0.115;
    const o = osc("triangle", f);
    const g = gainNode();
    punch(g, t + off, 0.24, 0.01, i === 3 ? 0.6 : 0.24);
    o.connect(g);
    g.connect(master);
    o.start(t + off);
    o.stop(t + off + 0.7);

    // 加一层弱方波做泛音，让号角感更足
    const o2 = osc("square", f * 2);
    const g2 = gainNode();
    punch(g2, t + off, 0.05, 0.01, 0.18);
    o2.connect(g2);
    g2.connect(master);
    o2.start(t + off);
    o2.stop(t + off + 0.3);
  });
}

/** 失败：下行小调，闷、慢 */
function defeat() {
  const t = begin();
  if (t === null) return;

  [392, 329.63, 261.63, 196].forEach((f, i) => {
    const off = i * 0.2;
    const o = osc("sawtooth", f);
    const lp = filter("lowpass", 950);
    const g = gainNode();
    punch(g, t + off, 0.2, 0.02, i === 3 ? 0.95 : 0.32);
    o.connect(lp);
    lp.connect(g);
    g.connect(master);
    o.start(t + off);
    o.stop(t + off + 1.1);
  });
}

/* ---------- 静音开关 ---------- */

function setMuted(v) {
  muted = !!v;
  writeMuted(muted);
  if (master && ctx) {
    // 用短 ramp 避免直接改 gain 产生咔哒声
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t);
    master.gain.exponentialRampToValueAtTime(muted ? 0.0001 : 0.85, t + 0.08);
  }
  return muted;
}

function isMuted() {
  return muted;
}

/**
 * 静音按钮挂载到 <body>（右上角固定定位）。
 * 关键：挂在 body 而不是 #app，所以 main.js 的 innerHTML 全量重渲染碰不到它。
 */
function mountToggle() {
  if (document.getElementById("sfx-toggle")) return;

  const btn = document.createElement("button");
  btn.id = "sfx-toggle";
  btn.className = "sfx-toggle";
  btn.type = "button";

  const paint = () => {
    btn.textContent = muted ? "🔇" : "🔊";
    btn.title = muted ? "音效已关闭（点击开启）" : "音效已开启（点击静音）";
    btn.setAttribute("aria-label", btn.title);
    btn.dataset.muted = muted ? "1" : "0";
  };

  btn.addEventListener("click", () => {
    const nowMuted = setMuted(!muted);
    paint();
    if (!nowMuted) {
      // 这次点击本身就是用户手势，可以安全地起 AudioContext
      init();
      click();
    }
  });

  paint();
  document.body.appendChild(btn);
}

// 兜底：如果 AudioContext 已存在但被浏览器挂起（切标签页回来等），
// 任何一次指针按下都尝试恢复。注意这里【不会】凭空创建 context。
window.addEventListener(
  "pointerdown",
  () => {
    if (ctx) resume();
  },
  { passive: true }
);

export const sfx = {
  init,
  fire,
  hit,
  miss,
  sunk,
  place,
  deny,
  click,
  incoming,
  victory,
  defeat,
  setMuted,
  isMuted,
  mountToggle,
};

export default sfx;
