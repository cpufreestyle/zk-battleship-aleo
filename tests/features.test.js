/**
 * features.test.js — features.js 纯逻辑测试
 *
 * 运行环境：node（无浏览器）。localStorage 用 vi.stubGlobal 提供内存替身，
 * 这是浏览器外部 API 的替身，不是被测模块的 mock——被测的是真实逻辑。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  WEAPONS, initWeapons, canUseWeapon, consumeWeapon,
  WEATHER, rollWeather, applyWeatherEffect, isScanDisabled,
  checkSubmarineDodge, getRevealCell, checkFrigateRapidFire,
  getRank, getRankProgress, calculateElo,
  loadRankData, recordMatch, getStreakBonus,
  loadStats, recordStats, getStatsView,
} from "../features.js";

// ---------- localStorage 内存替身（外部 API 替身） ----------
function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", fakeStorage());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ===== 武器系统 =====
describe("initWeapons / canUseWeapon / consumeWeapon", () => {
  it("初始化后三种武器各 1 次且未选中", () => {
    const w = initWeapons();
    expect(w.torpedo.remaining).toBe(1);
    expect(w.depthCharge.remaining).toBe(1);
    expect(w.emp.remaining).toBe(1);
    expect(w.selectedWeapon).toBeNull();
  });

  it("剩余次数 >0 可用，=0 不可用", () => {
    const w = initWeapons();
    expect(canUseWeapon(w, "torpedo")).toBe(true);
    consumeWeapon(w, "torpedo");
    expect(w.torpedo.remaining).toBe(0);
    expect(canUseWeapon(w, "torpedo")).toBe(false);
  });

  it("未知武器 id 不可用，消耗是空操作", () => {
    const w = initWeapons();
    expect(canUseWeapon(w, "nuke")).toBe(false);
    expect(() => consumeWeapon(w, "nuke")).not.toThrow();
  });
});

// ===== 天气系统 =====
describe("rollWeather / applyWeatherEffect / isScanDisabled", () => {
  it("rollWeather 只返回三种天气之一", () => {
    for (let i = 0; i < 50; i++) {
      expect(["clear", "fog", "storm"]).toContain(rollWeather());
    }
  });

  it("rollWeather 概率分布：clear 0.5 / fog 0.25 / storm 0.25", () => {
    const spy = vi.spyOn(Math, "random");
    const counts = { clear: 0, fog: 0, storm: 0 };
    for (const r of [0.1, 0.6, 0.8]) {
      spy.mockReturnValueOnce(r);
      counts[rollWeather()]++;
    }
    expect(counts).toEqual({ clear: 1, fog: 1, storm: 1 });
  });

  it("非风暴天气不偏移", () => {
    expect(applyWeatherEffect("clear", 2, 2, 5)).toEqual({ row: 2, col: 2, deviated: false });
    expect(applyWeatherEffect("fog", 2, 2, 5)).toEqual({ row: 2, col: 2, deviated: false });
  });

  it("风暴时 90% 概率不偏移（random > 0.1）", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(applyWeatherEffect("storm", 2, 2, 5)).toEqual({ row: 2, col: 2, deviated: false });
    spy.mockRestore();
  });

  it("风暴偏移后落点必在棋盘内", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0); // 触发偏移，取第一个 delta [-1,0]
    const r = applyWeatherEffect("storm", 2, 2, 5);
    expect(r.deviated).toBe(true);
    expect(r.row).toBeGreaterThanOrEqual(0);
    expect(r.row).toBeLessThan(5);
    expect(r.col).toBeGreaterThanOrEqual(0);
    expect(r.col).toBeLessThan(5);
    spy.mockRestore();
  });

  it("isScanDisabled：雾天禁用扫描，其他天气不禁用", () => {
    expect(isScanDisabled("fog")).toBe(true);
    expect(isScanDisabled("clear")).toBe(false);
    expect(isScanDisabled("storm")).toBe(false);
  });
});

// ===== 舰船被动技能 =====
describe("checkSubmarineDodge / getRevealCell / checkFrigateRapidFire", () => {
  it("潜艇可闪避一次，之后不可再闪避", () => {
    const mine = [{ name: "Submarine" }];
    expect(checkSubmarineDodge(mine, [], true)).toBe(true);
    expect(mine[0].dodgeUsed).toBe(true);
    expect(checkSubmarineDodge(mine, [], true)).toBe(false);
  });

  it("没有潜艇时闪避失败", () => {
    const mine = [{ name: "Destroyer" }];
    expect(checkSubmarineDodge(mine, [], true)).toBe(false);
  });

  it("getRevealCell 优先揭示有船的相邻格", () => {
    // 5x5，船在 (1,1)（bit 6）；命中 (1,0)；未射击过
    const ships = 1 << (1 * 5 + 1); // bit 6
    const shots = 1 << (1 * 5 + 0); // bit 5 已射击（就是命中格）
    const r = getRevealCell(ships, 1, 0, shots, 5);
    expect(r).toEqual({ row: 1, col: 1, hasShip: true });
  });

  it("getRevealCell 过滤掉已射击的格", () => {
    // 命中 (0,0)；相邻 (1,0) 已射击，(0,1) 未射击且无船
    const ships = 0;
    const shots = (1 << (1 * 5 + 0)) | (1 << 0);
    const r = getRevealCell(ships, 0, 0, shots, 5);
    expect(r).toEqual({ row: 0, col: 1, hasShip: false });
  });

  it("getRevealCell 所有相邻格都已射击时返回 null", () => {
    // 中心 (2,2)，四邻全部已射击
    const shots = (1 << 7) | (1 << 17) | (1 << 11) | (1 << 13) | (1 << 12);
    expect(getRevealCell(0, 2, 2, shots, 5)).toBeNull();
  });

  it("护卫舰速射：每 3 回合且舰队有护卫舰才触发", () => {
    const withFrigate = [{ name: "Frigate" }];
    const withoutFrigate = [{ name: "Destroyer" }];
    expect(checkFrigateRapidFire(withFrigate, 3)).toBe(true);
    expect(checkFrigateRapidFire(withFrigate, 6)).toBe(true);
    expect(checkFrigateRapidFire(withFrigate, 0)).toBe(false);
    expect(checkFrigateRapidFire(withFrigate, 4)).toBe(false);
    expect(checkFrigateRapidFire(withoutFrigate, 3)).toBe(false);
  });
});

// ===== ELO 排名 =====
describe("calculateElo / getRank / getRankProgress / getStreakBonus", () => {
  it("同分获胜 +16 分，期望胜率 50%", () => {
    const r = calculateElo(1000, 1000, true);
    expect(r.change).toBe(16);
    expect(r.newRating).toBe(1016);
    expect(r.expected).toBe(50);
  });

  it("同分失败 -16 分", () => {
    const r = calculateElo(1000, 1000, false);
    expect(r.change).toBe(-16);
    expect(r.newRating).toBe(984);
  });

  it("以弱胜强得分更多（k=32）", () => {
    const upset = calculateElo(1000, 1400, true);
    const expected = calculateElo(1000, 1400, true).expected;
    expect(upset.change).toBeGreaterThan(16);
    expect(expected).toBeLessThan(50);
  });

  it("积分下限为 0：低分玩家输给同分对手不会为负", () => {
    const r = calculateElo(10, 10, false); // -16 → 钳位到 0
    expect(r.newRating).toBe(0);
  });

  it("段位阈值：0/1199 青铜，1200 白银，1500 黄金，1800 铂金，2100+ 钻石", () => {
    expect(getRank(0).nameEn).toBe("Bronze");
    expect(getRank(1199).nameEn).toBe("Bronze");
    expect(getRank(1200).nameEn).toBe("Silver");
    expect(getRank(1500).nameEn).toBe("Gold");
    expect(getRank(1800).nameEn).toBe("Platinum");
    expect(getRank(2100).nameEn).toBe("Diamond");
    expect(getRank(9999).nameEn).toBe("Diamond");
  });

  it("段位进度：距下一档的百分比；钻石段位无下一档", () => {
    const p = getRankProgress(1350); // 白银 1200→黄金 1500，走了一半
    expect(p.current.nameEn).toBe("Silver");
    expect(p.next.nameEn).toBe("Gold");
    expect(p.progress).toBe(50);
    expect(p.toNext).toBe(150);

    const d = getRankProgress(2500);
    expect(d.next).toBeNull();
    expect(d.progress).toBe(100);
    expect(d.toNext).toBe(0);
  });

  it("连胜口号阈值：2 无、3/5/7/10 各有口号", () => {
    expect(getStreakBonus(2)).toBe("");
    expect(getStreakBonus(3)).toContain("三连胜");
    expect(getStreakBonus(5)).toContain("五连胜");
    expect(getStreakBonus(7)).toContain("七连胜");
    expect(getStreakBonus(10)).toContain("十连胜");
  });
});

// ===== 排名持久化 + 战绩统计 =====
describe("recordMatch / recordStats / getStatsView（localStorage 替身）", () => {
  it("首胜：+16 分，streak=1", () => {
    const r = recordMatch(true, 1000);
    expect(r.change).toBe(16);
    expect(r.streak).toBe(1);
    expect(r.rank.nameEn).toBe("Bronze");
    expect(loadRankData().wins).toBe(1);
  });

  it("连胜计数与失败清零（-1 表示连败起点）", () => {
    recordMatch(true, 1000);
    recordMatch(true, 1000);
    let r = recordMatch(true, 1000);
    expect(r.streak).toBe(3);
    r = recordMatch(false, 1000);
    expect(r.streak).toBe(-1);
    r = recordMatch(false, 1000);
    expect(r.streak).toBe(-2);
    expect(loadRankData().bestStreak).toBe(3);
  });

  it("recordStats 累计场次/胜负/命中，bestCombo 取最大", () => {
    recordStats({ won: true, shots: 10, hits: 5, bestCombo: 3, zkProofs: 12 });
    const s = recordStats({ won: false, shots: 8, hits: 4, bestCombo: 5, zkProofs: 9 });
    expect(s.games).toBe(2);
    expect(s.wins).toBe(1);
    expect(s.losses).toBe(1);
    expect(s.shots).toBe(18);
    expect(s.hits).toBe(9);
    expect(s.bestCombo).toBe(5);
    expect(s.zkProofs).toBe(21);
  });

  it("getStatsView 计算胜率/命中率，空数据为 0", () => {
    let v = getStatsView();
    expect(v.winRate).toBe(0);
    expect(v.hitRate).toBe(0);
    recordStats({ won: true, shots: 10, hits: 5, bestCombo: 0, zkProofs: 0 });
    v = getStatsView();
    expect(v.winRate).toBe(100);
    expect(v.hitRate).toBe(50);
  });
});
