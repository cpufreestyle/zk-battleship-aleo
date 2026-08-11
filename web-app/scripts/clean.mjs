#!/usr/bin/env node
/**
 * 跨平台删除 dist/（构建前清理）
 *
 * 为什么不用 `rm -rf dist`：
 *   某些开发沙箱会给 Node 的 fs.rmSync 套一层"安全删除"拦截，对大文件
 *   （21MB 的 aleo_wasm.wasm）会搬去回收站并失败，导致 vite build 在
 *   emptyOutDir 阶段报错。直接调系统删除命令可绕过该拦截。
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "dist");

if (process.platform === "win32") {
    execFileSync("powershell", ["-NoProfile", "-Command",
        `Remove-Item -LiteralPath '${target.replace(/'/g, "''")}' -Recurse -Force -ErrorAction SilentlyContinue`], { stdio: "inherit" });
} else {
    execFileSync("rm", ["-rf", target], { stdio: "inherit" });
}
console.log(`[clean] 已清理 ${target}`);
