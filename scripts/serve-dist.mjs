#!/usr/bin/env node
/**
 * dist/ 静态预览服务器 —— 用来在本机复现各种线上托管环境
 *
 * 为什么不用 `vite preview`：
 *   vite preview 永远下发 COOP/COEP，只能验证"最好情况"。
 *   而本项目最大的风险恰恰是"线上拿不到这两个头"。必须能本地复现降级路径。
 *
 * 用法
 * ----
 * 1) 模拟已隔离环境（本机 dev / itch.io 勾了 SharedArrayBuffer / Netlify）
 *      node scripts/serve-dist.mjs
 *      → 期望：真 ZK 生效，控制台出现 "[ZK] 引擎就绪"
 *
 * 2) 模拟不能自定义响应头的托管（GitHub Pages / CloudStudio）
 *      node scripts/serve-dist.mjs --no-coi
 *      → 期望：coi-serviceworker 注册并自动重载一次，之后恢复隔离、真 ZK 生效
 *
 * 3) 模拟连 Service Worker 都救不了的最坏情况（iframe 受限等）
 *      node scripts/serve-dist.mjs --no-coi
 *      浏览器打开 http://localhost:4173/?nocoi=1
 *      → 期望：**不白屏**、不卡死，游戏正常可玩，ZK 显示为降级
 *
 * 4) 模拟子路径部署（GitHub Pages 的 /repo-name/ 场景），验证 base:"./"
 *      node scripts/serve-dist.mjs --mount /shadowfleet/
 *      → 期望：资源全部 200，没有任何 /assets/... 404
 *
 * 其它参数：--port 4173  --dir dist
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// ---------- 参数解析 ----------
const argv = process.argv.slice(2);
function flag(name) {
    return argv.includes(name);
}
function opt(name, fallback) {
    const i = argv.indexOf(name);
    return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
}

const COI = !flag("--no-coi");
const PORT = Number(opt("--port", "4173"));
const ROOT = path.resolve(projectRoot, opt("--dir", "dist"));
let MOUNT = opt("--mount", "/");
if (!MOUNT.startsWith("/")) MOUNT = "/" + MOUNT;
if (!MOUNT.endsWith("/")) MOUNT += "/";

if (!fs.existsSync(ROOT)) {
    console.error(`[serve] 找不到目录 ${ROOT}，请先执行 npm run build`);
    process.exit(1);
}

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".wasm": "application/wasm",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".ico": "image/x-icon",
    ".ogg": "audio/ogg",
    ".mp3": "audio/mpeg",
    ".webm": "video/webm",
    ".map": "application/json; charset=utf-8",
};

const server = http.createServer((req, res) => {
    let urlPath;
    try {
        urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
        res.writeHead(400).end("Bad Request");
        return;
    }

    // 处理挂载子路径
    if (MOUNT !== "/") {
        if (urlPath === MOUNT.slice(0, -1)) {
            res.writeHead(302, { Location: MOUNT }).end();
            return;
        }
        if (!urlPath.startsWith(MOUNT)) {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
                .end(`404 — 站点挂载在 ${MOUNT}，请访问 http://localhost:${PORT}${MOUNT}`);
            return;
        }
        urlPath = "/" + urlPath.slice(MOUNT.length);
    }

    if (urlPath.endsWith("/")) urlPath += "index.html";

    // 防目录穿越
    const filePath = path.join(ROOT, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ""));
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403).end("Forbidden");
        return;
    }

    fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
                .end(`404 Not Found: ${urlPath}`);
            console.log(`  404  ${urlPath}`);
            return;
        }

        const headers = {
            "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
            "Content-Length": stat.size,
            // Service Worker 脚本绝不能被缓存，否则改了不生效
            "Cache-Control": filePath.endsWith("coi-serviceworker.js") ? "no-cache" : "no-store",
        };

        if (COI) {
            headers["Cross-Origin-Opener-Policy"] = "same-origin";
            headers["Cross-Origin-Embedder-Policy"] = "require-corp";
            headers["Cross-Origin-Resource-Policy"] = "cross-origin";
        }

        res.writeHead(200, headers);
        fs.createReadStream(filePath).pipe(res);
        console.log(`  200  ${urlPath}  (${(stat.size / 1024).toFixed(1)} KB)`);
    });
});

server.listen(PORT, () => {
    console.log("");
    console.log(`  隐海战舰 dist 预览服务器`);
    console.log(`  ------------------------------------------`);
    console.log(`  地址      http://localhost:${PORT}${MOUNT}`);
    console.log(`  目录      ${ROOT}`);
    console.log(`  COOP/COEP ${COI ? "已下发（模拟隔离环境）" : "未下发（模拟 GitHub Pages / itch.io 未勾选）"}`);
    if (!COI) {
        console.log(`  提示      加 ?nocoi=1 可关闭 Service Worker 兜底，验证纯降级路径不白屏`);
    }
    console.log("");
});
