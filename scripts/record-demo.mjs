#!/usr/bin/env node
/**
 * Record a comprehensive demo video of Shadow Fleet showcasing all features:
 * 1. Start screen with mode/difficulty/fleet selection + Web3 badges
 * 2. Interactive tutorial
 * 3. Ship placement (manual + random)
 * 4. Battle with ZK proofs, combo, weapons, scan
 * 5. Blockchain stats bar + proof panel
 * 6. Game over with blockchain summary
 */

import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const PORT = 4173;

const server = spawn("node", ["scripts/serve-dist.mjs", "--port", String(PORT)], {
  cwd: projectRoot,
  stdio: "pipe",
  env: { ...process.env },
});

await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("Server timeout")), 10000);
  server.stdout.on("data", (data) => {
    if (data.toString().includes(`localhost:${PORT}`)) {
      clearTimeout(timeout);
      resolve();
    }
  });
  server.stderr.on("data", (data) => console.error("[server]", data.toString()));
});

console.log("[record] Server ready");

const browser = await chromium.launch({
  headless: true,
  args: ["--enable-features=SharedArrayBuffer"],
});

const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: {
    dir: path.join(projectRoot, "demo-recording"),
    size: { width: 1280, height: 800 },
  },
});

const page = await context.newPage();

page.on("console", (msg) => {
  const text = msg.text();
  if (text.includes("[ZK]") || text.includes("error") || text.includes("Error")) {
    console.log(`[browser] ${text}`);
  }
});

// ===== SCENE 1: Start screen (mode selection, difficulty, fleet) =====
console.log("[record] Scene 1: Start screen...");
await page.goto(`http://localhost:${PORT}`, { waitUntil: "networkidle" });
await page.waitForSelector("#app", { timeout: 10000 });
await page.waitForTimeout(8000); // ZK engine load
await page.waitForTimeout(4000); // Show start screen

// Show mode options
const modeBtns = page.locator(".mode-btn");
console.log(`[record] Mode buttons: ${await modeBtns.count()}`);
await page.waitForTimeout(3000);

// ===== SCENE 2: Tutorial =====
console.log("[record] Scene 2: Tutorial...");
const tutBtn = page.locator("text=玩法教程");
if (await tutBtn.count() > 0) {
  await tutBtn.first().click();
  await page.waitForTimeout(2500);
  // Step through 2 tutorial steps
  for (let i = 0; i < 2; i++) {
    const nextBtn = page.locator(".tut-next");
    if (await nextBtn.count() > 0) {
      await nextBtn.first().click();
      await page.waitForTimeout(1800);
    }
  }
  // Close tutorial
  const closeBtn = page.locator(".tut-close");
  if (await closeBtn.count() > 0) {
    await closeBtn.first().click();
    await page.waitForTimeout(1000);
  }
}

// ===== SCENE 3: Start game (hard difficulty, extended fleet) =====
console.log("[record] Scene 3: Start game...");
// Select hard difficulty
const hardBtn = page.locator(".diff-btn", { hasText: "困难" });
if (await hardBtn.count() > 0) {
  await hardBtn.click();
  await page.waitForTimeout(800);
}
// Select extended fleet
const extBtn = page.locator(".fleet-btn", { hasText: "扩展" });
if (await extBtn.count() > 0) {
  await extBtn.click();
  await page.waitForTimeout(800);
}
await page.waitForTimeout(2000);

// Start game
await page.click("text=开始对战");
await page.waitForTimeout(2000);

// ===== SCENE 4: Random placement (faster for demo) =====
console.log("[record] Scene 4: Random placement...");
const randBtn = page.locator("text=随机放置");
if (await randBtn.count() > 0) {
  await randBtn.first().click();
  await page.waitForTimeout(3000);
} else {
  // Manual placement fallback
  const placements = [[0,0],[0,1],[0,2],[2,0],[2,1],[4,0],[4,1],[1,3],[1,4],[3,2]];
  for (const [r, c] of placements) {
    const cell = page.locator(`[data-cell="player-${r}-${c}"]`);
    if (await cell.count() > 0) {
      await cell.click();
      await page.waitForTimeout(600);
    }
  }
  await page.waitForTimeout(2000);
}

// ===== SCENE 5: Battle with ZK proofs =====
console.log("[record] Scene 5: Battle...");
await page.waitForTimeout(3000);

const targets = [
  [0, 0], [0, 2], [1, 1], [2, 3], [3, 0],
  [4, 4], [1, 3], [3, 2], [0, 4], [2, 0],
  [4, 2], [1, 0], [3, 4], [0, 1], [2, 2],
  [4, 0], [1, 4], [3, 1], [0, 3], [2, 4],
  [4, 1], [1, 2], [3, 3], [2, 1], [4, 3],
];

let shotsFired = 0;
for (const [r, c] of targets) {
  await page.waitForTimeout(3000);

  // Handle education quiz overlay if it appears (answer it — it's a demo feature!)
  const quizCard = page.locator(".edu-quiz-card");
  if (await quizCard.count() > 0 && await quizCard.first().isVisible()) {
    console.log("[record] Education quiz appeared — answering...");
    await page.waitForTimeout(2500); // Let viewers read the question
    // Click the correct answer (usually option index 1) — or first option as fallback
    const options = page.locator(".edu-option, .quiz-option, .edu-quiz-card button");
    const optCount = await options.count();
    if (optCount > 1) {
      await options.nth(1).click().catch(() => {});
    } else if (optCount === 1) {
      await options.first().click().catch(() => {});
    }
    await page.waitForTimeout(2000);
    // Dismiss explanation if shown (match known button text in page)
    await page.evaluate(() => {
      const candidates = ["继续", "确定", "知道了", "关闭", "完成", "存入卡片"];
      const btns = Array.from(document.querySelectorAll("button, .edu-dismiss, .quiz-dismiss"));
      const target = btns.find(b => {
        const t = (b.textContent || "").trim();
        return t && candidates.some(c => t.includes(c));
      });
      if (target) target.click();
    });
    await page.waitForTimeout(1500);
  }

  const el = page.locator(`[data-cell="opponent-${r}-${c}"]`);
  if (await el.count() === 0) continue;

  const clickable = await el.evaluate((node) => node.hasAttribute("onclick"));
  if (!clickable) continue;

  await el.click();
  shotsFired++;
  console.log(`[record] Fired at opponent-${r}-${c} (${shotsFired})`);

  if (await page.locator("text=下一局").count() > 0 || await page.locator("text=返回主菜单").count() > 0) {
    console.log(`[record] Game ended after ${shotsFired} shots!`);
    break;
  }
}

// ===== SCENE 6: Game over screen =====
console.log("[record] Scene 6: Game over...");
await page.waitForTimeout(5000);

// ===== Save =====
console.log("[record] Saving video...");
await context.close();
await browser.close();
server.kill();
console.log("[record] Done!");
