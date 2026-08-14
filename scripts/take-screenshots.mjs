#!/usr/bin/env node
/**
 * Capture 4 README screenshots:
 * 1. start.png    — start screen with modes + career panel
 * 2. battle.png   — battle with ZK proof overlay + blockchain bar
 * 3. zk-lab.png   — privacy demo (dual view)
 * 4. gameover.png — game over with blockchain summary
 */

import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outDir = path.join(projectRoot, "screenshots");
fs.mkdirSync(outDir, { recursive: true });

const PORT = 4173;
const server = spawn("node", ["scripts/serve-dist.mjs", "--port", String(PORT)], {
  cwd: projectRoot, stdio: "pipe", env: { ...process.env },
});
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("server timeout")), 10000);
  server.stdout.on("data", d => { if (d.toString().includes(String(PORT))) { clearTimeout(t); resolve(); } });
});

const browser = await chromium.launch({ headless: true, args: ["--enable-features=SharedArrayBuffer"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", e => console.log("[pageerror]", e.message));

await page.goto(`http://localhost:${PORT}`, { waitUntil: "networkidle" });
await page.waitForSelector("#app", { timeout: 10000 });
await page.waitForTimeout(6000); // ZK engine

// ===== 1. Start screen (with career stats seeded) =====
await page.evaluate(() => {
  localStorage.setItem("sf_stats_v1", JSON.stringify({ games: 12, wins: 8, losses: 4, shots: 140, hits: 84, bestCombo: 6, zkProofs: 156 }));
  localStorage.setItem("sf_rank", JSON.stringify({ rating: 1240, wins: 8, losses: 4, streak: 3, bestStreak: 5, history: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(4000);
await page.screenshot({ path: path.join(outDir, "start.png") });
console.log("✓ start.png");

// ===== 3. ZK Lab privacy demo =====
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll("button")).find(b => (b.textContent || "").includes("课堂"));
  if (btn) btn.click();
});
await page.waitForTimeout(1000);
const privCard = page.locator('.edu-lab-card:has-text("隐私保护")');
if (await privCard.count() > 0) {
  await privCard.click();
  await page.waitForTimeout(600);
  // Fire one shot to show a hit result
  await page.locator(".edu-priv-cell.is-clickable").first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, "zk-lab.png") });
  console.log("✓ zk-lab.png");
} else {
  console.log("✗ privacy lab card not found");
}
await page.evaluate(() => { try { window.eduCloseLab(); } catch (e) {} });
await page.evaluate(() => { try { window.closeEdu(); } catch (e) {} });
await page.waitForTimeout(600);

// ===== 2. Battle screen =====
await page.click("text=开始对战");
await page.waitForTimeout(1500);
// Random placement
const randBtn = page.locator("text=随机放置");
if (await randBtn.count() > 0) {
  await randBtn.first().click();
  await page.waitForTimeout(2500);
}
// Fire 2 shots to populate battle log + blockchain bar
for (const [r, c] of [[0, 0], [1, 2]]) {
  const cell = page.locator(`[data-cell="opponent-${r}-${c}"]`);
  if (await cell.count() > 0) {
    await cell.click().catch(() => {});
    await page.waitForTimeout(3200);
  }
}
await page.screenshot({ path: path.join(outDir, "battle.png") });
console.log("✓ battle.png");

// ===== 4. Game over =====
// Fire remaining cells rapidly until game ends
const targets = [[0,1],[0,2],[0,3],[0,4],[1,0],[1,1],[1,3],[1,4],[2,0],[2,1],[2,2],[2,3],[2,4],[3,0],[3,1],[3,2],[3,3],[3,4],[4,0],[4,1],[4,2],[4,3],[4,4]];
let fired = 0;
for (const [r, c] of targets) {
  // handle education quiz if it pops up
  const quiz = page.locator(".edu-quiz-card");
  if (await quiz.count() > 0 && await quiz.first().isVisible().catch(() => false)) {
    await page.waitForTimeout(1500);
    const opts = page.locator(".edu-option, .quiz-option");
    if (await opts.count() > 1) await opts.nth(1).click().catch(() => {});
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      const cands = ["继续", "确定", "知道了", "关闭", "完成", "存入卡片"];
      const btns = Array.from(document.querySelectorAll("button"));
      const t = btns.find(b => { const x = (b.textContent || "").trim(); return x && cands.some(c => x.includes(c)); });
      if (t) t.click();
    });
    await page.waitForTimeout(800);
  }
  const el = page.locator(`[data-cell="opponent-${r}-${c}"]`);
  if (await el.count() === 0) continue;
  const clickable = await el.evaluate(n => n.hasAttribute("onclick")).catch(() => false);
  if (!clickable) continue;
  await el.click().catch(() => {});
  fired++;
  await page.waitForTimeout(2800);
  if (await page.locator(".game-over-overlay").count() > 0) break;
}
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(outDir, "gameover.png") });
console.log("✓ gameover.png (fired " + fired + ")");

await browser.close();
server.kill();
console.log("Done → screenshots/");
