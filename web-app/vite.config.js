import { defineConfig } from "vite";

/**
 * Shadow Fleet — build/deploy pipeline config
 *
 * 关键决策（见 DEPLOY.md 的完整说明）：
 *
 * 1. base: "./"
 *    itch.io / GitHub Pages 子路径 / CloudStudio 都不把站点挂在域名根目录。
 *    绝对路径 "/assets/xxx" 在这些环境下必然 404。相对 base 让产物可以
 *    被放进任意子目录。需要固定绝对路径时用 VITE_BASE 环境变量覆盖。
 *
 * 2. build.target: "esnext"
 *    @provablehq/wasm 的 glue 代码里有模块顶层 await（`await __wbg_init(...)`）。
 *    Vite 6 默认 target 是 baseline-widely-available，不支持顶层 await，
 *    build 会直接报错失败。这是本项目此前从未产出过静态包的根因。
 *    esnext 的实际浏览器下限：Chrome 89+ / Firefox 89+ / Safari 15+。
 *
 * 3. server/preview 都下发 COOP+COEP
 *    本机开发与本机预览行为一致，避免"dev 能跑、preview 挂"的假阳性。
 *    线上没有这两个头时由 zk.js 的能力探测 + coi-serviceworker 兜底。
 */
export default defineConfig({
    // 允许 web-release 用 VITE_BASE=/repo-name/ 覆盖成绝对子路径
    base: process.env.VITE_BASE || "./",

    assetsInclude: ["**/*.wasm"],

    optimizeDeps: {
        // Aleo wasm 不能被 esbuild 预打包，会破坏 import.meta.url 的 wasm 定位
        exclude: ["@provablehq/wasm", "@provablehq/sdk"],
    },

    worker: {
        format: "es",
    },

    build: {
        // 顶层 await 必需；低于 esnext 会 build 失败
        target: "esnext",

        // 21MB 的 aleo_wasm.wasm 绝不能被内联成 base64（会撑爆主 chunk）
        assetsInlineLimit: 4096,

        // Aleo SDK chunk 天然就是 MB 级，关掉噪音警告，改由 DEPLOY.md 记录体积基线
        chunkSizeWarningLimit: 8000,

        rollupOptions: {
            output: {
                // 让 ZK 引擎 chunk 在产物里一眼可辨，便于排查体积与缓存
                chunkFileNames(chunkInfo) {
                    const ids = chunkInfo.moduleIds || Object.keys(chunkInfo.modules || {});
                    const isAleo = ids.some((id) => id.includes("@provablehq"));
                    return isAleo
                        ? "assets/aleo-zk-[hash].js"
                        : "assets/[name]-[hash].js";
                },
            },
        },
    },

    server: {
        headers: {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
        },
    },

    // vite preview 也必须隔离，否则预览环境和 dev 行为不一致
    preview: {
        headers: {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
        },
    },
});
