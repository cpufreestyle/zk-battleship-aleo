#!/usr/bin/env node
/**
 * Record a demo video of Shadow Fleet gameplay using Playwright.
 *
 * Usage:
 *   node scripts/record-demo.mjs
 */

import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const PORT = 4173;

// Start server
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

// --- Navigate ---
console.log("[record] Loading app...");
await page.goto(`http://localhost:${PORT}`, { waitUntil: "networkidle" });
await page.waitForSelector("#app", { timeout: 10000 });

// Wait for ZK engine
console.log("[record] Waiting for ZK engine (8s)...");
await page.waitForTimeout(8000);

// --- Show start screen ---
console.log("[record] Start screen (3s)...");
await page.waitForTimeout(3000);

// --- Start game ---
console.log("[record] Clicking 开始游戏...");
await page.click("text=开始游戏");
await page.waitForTimeout(2000);

// --- Verify we're in placement phase ---
const phase = await page.evaluate(() => document.querySelector("#app")?.innerHTML?.includes("放置") ? "placement" : "other");
console.log(`[record] Phase after start: ${phase}`);

// --- Place ships ---
// Ships: Destroyer(3), Frigate(2), Submarine(2) = 7 cells, all horizontal
console.log("[record] Placing ships...");
const placements = [
  [0, 0], [0, 1], [0, 2],  // Destroyer (3 cells)
  [2, 0], [2, 1],            // Frigate (2 cells)
  [4, 0], [4, 1],            // Submarine (2 cells)
];

for (const [r, c] of placements) {
  const sel = `[data-cell="player-${r}-${c}"]`;
  const el = page.locator(sel);
  if (await el.count() > 0) {
    await el.click();
    console.log(`[record]   Placed at player-${r}-${c}`);
    await page.waitForTimeout(700);
  } else {
    console.log(`[record]   WARNING: cell player-${r}-${c} not found!`);
  }
}

// Wait for battle phase transition
console.log("[record] Waiting for battle phase...");
await page.waitForTimeout(3000);

// Check phase
const battleReady = await page.evaluate(() => {
  const app = document.querySelector("#app");
  return app?.innerHTML?.includes("敌方") || app?.innerHTML?.includes("Enemy") || false;
});
console.log(`[record] Battle phase ready: ${battleReady}`);

// --- Fire at enemy ---
console.log("[record] Firing at enemy grid...");

const targets = [
  [0, 0], [0, 2], [1, 1], [2, 3], [3, 0],
  [4, 4], [1, 3], [3, 2], [0, 4], [2, 0],
  [4, 2], [1, 0], [3, 4], [0, 1], [2, 2],
  [4, 0], [1, 4], [3, 1], [0, 3], [2, 4],
  [4, 1], [1, 2], [3, 3], [2, 1], [4, 3],
];

let shotsFired = 0;
for (const [r, c] of targets) {
  // Fixed delay between shots — inputLocked is module-scoped, can't check from page context.
  // Full cycle: lock_on(150ms) + suspense(300ms) + result_hold(260ms) + opponent(~1200ms) ≈ 2s
  await page.waitForTimeout(3500);

  const sel = `[data-cell="opponent-${r}-${c}"]`;
  const el = page.locator(sel);
  if (await el.count() === 0) {
    console.log(`[record]   SKIP opponent-${r}-${c} (not found)`);
    continue;
  }

  // Check if cell has onclick (still fireable)
  const clickable = await el.evaluate((node) => node.hasAttribute("onclick"));
  if (!clickable) {
    console.log(`[record]   SKIP opponent-${r}-${c} (already fired)`);
    continue;
  }

  await el.click();
  shotsFired++;
  console.log(`[record]   Fired at opponent-${r}-${c} (shot ${shotsFired})`);

  // Check if game ended
  const restart = page.locator("text=再来一局");
  if (await restart.count() > 0) {
    console.log(`[record] Game ended after ${shotsFired} shots!`);
    break;
  }
}

// --- Show final state ---
console.log("[record] Final state (5s)...");
await page.waitForTimeout(5000);

// --- Close ---
console.log("[record] Saving video...");
await context.close();
await browser.close();
server.kill();

console.log("[record] Done!");
