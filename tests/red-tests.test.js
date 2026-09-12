/**
 * red-tests.test.js — TDD RED 阶段：驱动两个待实现行为的失败测试
 *
 * 1. 排名连胜加分：需求（排名模式）写明"连胜加成"，
 *    现状 getStreakBonus 只是口号文本，recordMatch 积分无任何加成。
 * 2. 风暴偏移边界退化：在棋盘边缘 deviated=true 但落点未变
 *    （delta 越界被 clamp 回原格），玩家会看到"风暴偏移"横幅却原地开火。
 *    期望：偏移必须落在与原格不同的相邻格。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { recordMatch } from "../features.js";
import { applyWeatherEffect } from "../features.js";

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

describe("RED: recordMatch 连胜积分加成（需求：连胜加成）", () => {
  function seedRank(streak) {
    const s = fakeStorage();
    s.setItem("sf_rank", JSON.stringify({
      rating: 1000, wins: 2, losses: 0, streak, bestStreak: streak, history: [],
    }));
    vi.stubGlobal("localStorage", s);
  }

  it("streak 2 → 3 时：基础 +16 + 连胜加成 20 = +36", () => {
    seedRank(2);
    const r = recordMatch(true, 1000); // 同分对手，基础恰为 +16
    expect(r.change).toBe(36);
  });

  it("失败局没有连胜加成（streak 5 时失败仍是 -16）", () => {
    seedRank(5);
    const r = recordMatch(false, 1000);
    expect(r.change).toBe(-16);
  });
});

describe("RED: 风暴偏移在边缘必须落在不同的相邻格", () => {
  it("角落 (0,0) 偏移后不再是原格", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0); // 触发偏移 + 取 delta[0]=[-1,0]
    const r = applyWeatherEffect("storm", 0, 0, 5);
    spy.mockRestore();
    expect(r.deviated).toBe(true);
    expect(r.row !== 0 || r.col !== 0).toBe(true);
  });

  it("边缘 (2,0) 偏移后不再是原格", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0); // delta[0]=[-1,0] 越界 → 应选其他相邻格
    const r = applyWeatherEffect("storm", 2, 0, 5);
    spy.mockRestore();
    expect(r.deviated).toBe(true);
    expect(r.row !== 2 || r.col !== 0).toBe(true);
  });
});
