/**
 * features.js — 可玩性增强模块
 *
 * 包含四大系统：
 * 1. 特殊武器 (Torpedo / Depth Charge / EMP)
 * 2. 天气系统 (Fog / Storm / Clear)
 * 3. 舰船被动技能 (Destroyer / Submarine / Frigate)
 * 4. ELO 排名系统 (Bronze → Diamond)
 *
 * 所有系统通过 state 注入，不修改 main.js 核心游戏逻辑。
 */

// ===== 1. 特殊武器配置 =====
export const WEAPONS = {
  torpedo: {
    id: "torpedo",
    icon: "🎯",
    name: "鱼雷",
    nameEn: "Torpedo",
    desc: "攻击整行 5 格",
    descEn: "Fire entire row (5 cells)",
    uses: 1,
    color: "#e74c3c",
  },
  depthCharge: {
    id: "depthCharge",
    icon: "💣",
    name: "深水炸弹",
    nameEn: "Depth Charge",
    desc: "3×3 区域全部开火",
    descEn: "Hit all cells in 3×3 area",
    uses: 1,
    color: "#f39c12",
  },
  emp: {
    id: "emp",
    icon: "⚡",
    name: "EMP",
    nameEn: "EMP",
    desc: "封锁对手一回合",
    descEn: "Skip opponent's next turn",
    uses: 1,
    color: "#a855f7",
  },
};

/** 初始化武器状态 */
export function initWeapons() {
  return {
    torpedo: { remaining: WEAPONS.torpedo.uses },
    depthCharge: { remaining: WEAPONS.depthCharge.uses },
    emp: { remaining: WEAPONS.emp.uses },
    selectedWeapon: null, // "torpedo" | "depthCharge" | "emp" | null
  };
}

/** 检查武器是否可用 */
export function canUseWeapon(weaponState, weaponId) {
  return weaponState[weaponId] && weaponState[weaponId].remaining > 0;
}

/** 消耗武器 */
export function consumeWeapon(weaponState, weaponId) {
  if (weaponState[weaponId]) {
    weaponState[weaponId].remaining--;
  }
}

// ===== 2. 天气系统 =====
export const WEATHER = {
  clear: { id: "clear", icon: "☀️", name: "晴朗", nameEn: "Clear", desc: "正常作战" },
  fog: { id: "fog", icon: "🌫️", name: "大雾", nameEn: "Fog", desc: "雷达扫描失效" },
  storm: { id: "storm", icon: "⛈️", name: "风暴", nameEn: "Storm", desc: "10% 射击偏移" },
};

/** 随机天气 */
export function rollWeather() {
  const rand = Math.random();
  if (rand < 0.5) return "clear";
  if (rand < 0.75) return "fog";
  return "storm";
}

/** 天气效果：风暴时 10% 概率偏移到相邻格 */
export function applyWeatherEffect(weather, row, col, gridSize) {
  if (weather !== "storm") return { row, col, deviated: false };
  if (Math.random() > 0.1) return { row, col, deviated: false };
  // 偏移到随机相邻格
  const deltas = [[-1,0],[1,0],[0,-1],[0,1]];
  const [dr, dc] = deltas[Math.floor(Math.random() * deltas.length)];
  const nr = Math.max(0, Math.min(gridSize - 1, row + dr));
  const nc = Math.max(0, Math.min(gridSize - 1, col + dc));
  return { row: nr, col: nc, deviated: true };
}

/** 天气是否禁用雷达扫描 */
export function isScanDisabled(weather) {
  return weather === "fog";
}

// ===== 3. 舰船被动技能 =====
export const SHIP_ABILITIES = {
  Destroyer: {
    id: "Destroyer",
    name: "侦察打击",
    nameEn: "Recon Strike",
    desc: "命中时揭示 1 个相邻格",
    descEn: "On hit, reveal 1 adjacent cell",
    trigger: "onHit",
  },
  Submarine: {
    id: "Submarine",
    name: "隐身",
    nameEn: "Stealth",
    desc: "每局可闪避 1 次攻击",
    descEn: "Dodge 1 attack per game",
    trigger: "onDefend",
  },
  Frigate: {
    id: "Frigate",
    name: "速射",
    nameEn: "Rapid Fire",
    desc: "每 3 回合可额外开火 1 次",
    descEn: "Extra shot every 3 turns",
    trigger: "onTurn",
  },
};

/** 检查潜艇闪避 */
export function checkSubmarineDodge(playerShipGroups, opponentShipGroups, isPlayer) {
  const groups = isPlayer ? playerShipGroups : opponentShipGroups;
  const sub = groups.find(g => g.name === "Submarine" && !g.dodgeUsed);
  if (sub) {
    sub.dodgeUsed = true;
    return true;
  }
  return false;
}

/** 检查驱逐舰侦察（命中后揭示相邻格） */
export function getRevealCell(opponentShips, hitRow, hitCol, playerShots, gridSize) {
  const neighbors = [];
  for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    const r = hitRow + dr, c = hitCol + dc;
    if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
      const bit = r * gridSize + c;
      if (!(playerShots & (1 << bit))) {
        neighbors.push({ row: r, col: c, hasShip: (opponentShips & (1 << bit)) !== 0 });
      }
    }
  }
  if (neighbors.length === 0) return null;
  // 优先揭示有船的格
  const withShip = neighbors.filter(n => n.hasShip);
  const pick = withShip.length > 0 ? withShip[0] : neighbors[0];
  return pick;
}

/** 检查护卫舰速射（每 3 回合额外开火） */
export function checkFrigateRapidFire(playerShipGroups, turnCount) {
  if (turnCount === 0 || turnCount % 3 !== 0) return false;
  return playerShipGroups.some(g => g.name === "Frigate");
}

// ===== 4. ELO 排名系统 =====
const RANKS = [
  { name: "青铜", nameEn: "Bronze",   min: 0,    icon: "🥉", color: "#cd7f32" },
  { name: "白银", nameEn: "Silver",   min: 1200, icon: "🥈", color: "#c0c0c0" },
  { name: "黄金", nameEn: "Gold",     min: 1500, icon: "🥇", color: "#ffd700" },
  { name: "铂金", nameEn: "Platinum", min: 1800, icon: "💠", color: "#00d4aa" },
  { name: "钻石", nameEn: "Diamond",  min: 2100, icon: "💎", color: "#b9f2ff" },
];

export function getRank(rating) {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (rating >= r.min) rank = r;
  }
  return rank;
}

export function getRankProgress(rating) {
  const rank = getRank(rating);
  const nextRank = RANKS.find(r => r.min > rank.min);
  if (!nextRank) return { current: rank, next: null, progress: 100, toNext: 0 };
  const progress = Math.round((rating - rank.min) / (nextRank.min - rank.min) * 100);
  return { current: rank, next: nextRank, progress, toNext: nextRank.min - rating };
}

/** ELO 计算 */
export function calculateElo(playerRating, opponentRating, won, k = 32) {
  const expected = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  const score = won ? 1 : 0;
  const change = Math.round(k * (score - expected));
  return {
    newRating: Math.max(0, playerRating + change),
    change,
    expected: Math.round(expected * 100),
  };
}

/** 加载/保存排名数据 */
export function loadRankData() {
  try {
    const data = localStorage.getItem("sf_rank");
    if (data) return JSON.parse(data);
  } catch (_) {}
  return { rating: 1000, wins: 0, losses: 0, streak: 0, bestStreak: 0, history: [] };
}

export function saveRankData(data) {
  try {
    localStorage.setItem("sf_rank", JSON.stringify(data));
  } catch (_) {}
}

/** 记录一局结果到排名 */
export function recordMatch(won, opponentRating = 1000) {
  const data = loadRankData();
  const elo = calculateElo(data.rating, opponentRating, won);
  data.rating = elo.newRating;
  if (won) {
    data.wins++;
    data.streak = data.streak >= 0 ? data.streak + 1 : 1;
  } else {
    data.losses++;
    data.streak = data.streak <= 0 ? data.streak - 1 : -1;
  }
  if (data.streak > (data.bestStreak || 0)) data.bestStreak = data.streak;
  data.history.unshift({ won, rating: data.rating, change: elo.change, time: Date.now() });
  if (data.history.length > 20) data.history.pop();
  saveRankData(data);
  return { ...elo, rank: getRank(data.rating), streak: data.streak };
}

/** 获取连胜加成描述 */
export function getStreakBonus(streak) {
  if (streak >= 10) return "🔥 十连胜！传奇司令员！";
  if (streak >= 7) return "🔥 七连胜！势不可挡！";
  if (streak >= 5) return "🔥 五连胜！海军名将！";
  if (streak >= 3) return "🔥 三连胜！渐入佳境！";
  return "";
}

// ===== 5. 战绩统计（SocialFi — 跨局持久化） =====
const STATS_KEY = "sf_stats_v1";

/** 加载战绩 */
export function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { games: 0, wins: 0, losses: 0, shots: 0, hits: 0, bestCombo: 0, zkProofs: 0 };
}

export function saveStats(data) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(data)); } catch (_) {}
}

/** 记录一局结束（胜负都记），入参为该局的射击/命中/连击/ZK数据 */
export function recordStats({ won, shots, hits, bestCombo, zkProofs }) {
  const s = loadStats();
  s.games++;
  if (won) s.wins++; else s.losses++;
  s.shots += shots || 0;
  s.hits += hits || 0;
  if ((bestCombo || 0) > s.bestCombo) s.bestCombo = bestCombo || 0;
  s.zkProofs += zkProofs || 0;
  saveStats(s);
  return s;
}

/** 汇总视图模型（给开始页/结算页渲染用） */
export function getStatsView() {
  const s = loadStats();
  const winRate = s.games ? Math.round((s.wins / s.games) * 100) : 0;
  const hitRate = s.shots ? Math.round((s.hits / s.shots) * 100) : 0;
  return { ...s, winRate, hitRate };
}
