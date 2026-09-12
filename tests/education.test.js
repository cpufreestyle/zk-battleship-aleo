/**
 * education.test.js — 知识问答 / 概念卡片逻辑测试
 * 纯数据 + 纯函数（HTML 渲染函数输出字符串，无需 DOM）。
 */
import { describe, it, expect } from "vitest";
import {
  QUIZZES, getQuizForTrigger,
  CONCEPT_CARDS, checkCardUnlock,
  renderQuizPopup, renderQuizResult, renderCardCollection,
} from "../education.js";

describe("QUIZZES 题库完整性", () => {
  it("每道题 id 唯一、答案索引有效、选项至少 2 个", () => {
    const ids = QUIZZES.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of QUIZZES) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.options.length);
      expect(q.trigger).toBeTruthy();
      expect(q.explanation).toBeTruthy();
    }
  });
});

describe("getQuizForTrigger", () => {
  it("按触发点返回未答过的题", () => {
    const q = getQuizForTrigger("firstHit", []);
    expect(q).not.toBeNull();
    expect(q.trigger).toBe("firstHit");
  });

  it("已答过该触发点的题则返回 null", () => {
    const q = getQuizForTrigger("firstHit", []);
    const again = getQuizForTrigger("firstHit", [q.id]);
    expect(again).toBeNull();
  });

  it("未知触发点返回 null", () => {
    expect(getQuizForTrigger("noSuchTrigger", [])).toBeNull();
  });
});

describe("renderQuizPopup / renderQuizResult", () => {
  it("弹窗包含题目与全部选项文本", () => {
    const q = QUIZZES[0];
    const html = renderQuizPopup(q);
    expect(html).toContain(q.question);
    for (const opt of q.options) expect(html).toContain(opt);
  });

  it("答对显示正确分支与奖励，答错显示鼓励分支", () => {
    const q = QUIZZES[0];
    const ok = renderQuizResult(q, q.answer);
    expect(ok).toContain("回答正确");
    expect(ok).toContain(q.reward);
    const bad = renderQuizResult(q, (q.answer + 1) % q.options.length);
    expect(bad).toContain("答错");
    expect(bad).toContain(q.explanation);
  });
});

describe("CONCEPT_CARDS / checkCardUnlock", () => {
  it("卡片 id 唯一且都有解锁键", () => {
    const ids = CONCEPT_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CONCEPT_CARDS) expect(c.unlockKey).toBeTruthy();
  });

  it("未解锁时返回对应卡片，已解锁返回 null", () => {
    const card = CONCEPT_CARDS[0];
    expect(checkCardUnlock(card.unlockKey, { unlockedCards: [] })).toBe(card);
    expect(checkCardUnlock(card.unlockKey, { unlockedCards: [card.id] })).toBeNull();
  });

  it("未知解锁键返回 null", () => {
    expect(checkCardUnlock("nope", { unlockedCards: [] })).toBeNull();
  });
});

describe("renderCardCollection", () => {
  it("展示已解锁/未解锁状态与计数", () => {
    const html = renderCardCollection([CONCEPT_CARDS[0].id]);
    expect(html).toContain(`1/${CONCEPT_CARDS.length}`);
    expect(html).toContain("is-unlocked");
    expect(html).toContain("is-locked");
    expect(html).toContain(CONCEPT_CARDS[0].name);
  });
});
