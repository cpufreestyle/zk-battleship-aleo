#!/usr/bin/env node
/**
 * 把 dist/ 打成 itch.io 可直接上传的 zip（index.html 位于压缩包根目录）
 *
 * 零依赖：Windows 走 PowerShell Compress-Archive，类 Unix 走系统 zip。
 *
 * 用法：npm run package:itch
 * 产出：release/shadowfleet-web.zip
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist");
const releaseDir = path.join(projectRoot, "release");
const zipPath = path.join(releaseDir, "shadowfleet-web.zip");

if (!fs.existsSync(distDir)) {
    console.error("[package] 找不到 dist/，请先执行 npm run build");
    process.exit(1);
}
if (!fs.existsSync(path.join(distDir, "index.html"))) {
    console.error("[package] dist/index.html 缺失，构建产物不完整");
    process.exit(1);
}

fs.mkdirSync(releaseDir, { recursive: true });
if (fs.existsSync(zipPath)) fs.rmSync(zipPath);

const isWindows = process.platform === "win32";
let result;

if (isWindows) {
    const ps = [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Compress-Archive -Path '${path.join(distDir, "*")}' -DestinationPath '${zipPath}' -Force`,
    ];
    result = spawnSync("powershell", ps, { stdio: "inherit" });
} else {
    result = spawnSync("zip", ["-r", "-q", zipPath, "."], {
        cwd: distDir,
        stdio: "inherit",
    });
}

if (!result || result.status !== 0) {
    console.error("[package] 打包失败。Windows 需要 PowerShell，类 Unix 需要 zip 命令。");
    process.exit(1);
}

const sizeMB = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);

console.log("");
console.log(`  已生成 ${path.relative(projectRoot, zipPath)}  (${sizeMB} MB)`);
console.log("");
console.log("  上传 itch.io 时务必确认：");
console.log("    1. 项目 Kind of project 选 HTML");
console.log("    2. 上传后勾选 \"This file will be played in the browser\"");
console.log("    3. Embed Options → Frame Options → 勾上 \"SharedArrayBuffer support\"");
console.log("       ← 不勾就没有 COOP/COEP，真 ZK 用不了，只会走本地降级");
console.log("    4. itch.io 单文件上限约 1GB，当前体积没问题");
console.log("");
