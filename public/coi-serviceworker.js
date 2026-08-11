/*!
 * coi-serviceworker — 在不能自定义响应头的静态托管上恢复跨源隔离
 *
 * 思路来自 gzuidhof/coi-serviceworker（MIT）。此处为本项目重写的精简实现，
 * 去掉了缓存逻辑，并加了更严的重载防护。
 *
 * ------------------------------------------------------------------
 * 它解决什么问题
 * ------------------------------------------------------------------
 * Aleo wasm 需要 SharedArrayBuffer，而 SharedArrayBuffer 需要页面处于
 * crossOriginIsolated 状态，也就是服务端下发：
 *     Cross-Origin-Opener-Policy: same-origin
 *     Cross-Origin-Embedder-Policy: require-corp
 *
 * GitHub Pages / CloudStudio 这类托管**不允许自定义响应头**。
 * Service Worker 可以拦截自己作用域内的请求并**重新合成带这两个头的响应**，
 * 从而让页面在纯静态托管上也拿到跨源隔离。
 *
 * ------------------------------------------------------------------
 * 安全护栏（很重要）
 * ------------------------------------------------------------------
 * 这个机制需要注册后**重载一次**页面才生效，写错了极易变成无限重载。
 * 因此：
 *   - 已经隔离了就直接退出，不注册
 *   - 每个标签页最多只重载 1 次（sessionStorage 计数）
 *   - URL 带 ?nocoi=1 或 window.__coiDisable=true 可一键关闭
 *   - 全程 try/catch，任何失败都静默放弃 —— 游戏本来就有本地降级分支，
 *     拿不到隔离只是没有真 ZK，不影响可玩性
 */
(function () {
    "use strict";

    var RELOAD_FLAG = "__coi_reloaded";

    // ============ Service Worker 侧 ============
    if (typeof self !== "undefined" && typeof self.document === "undefined") {
        self.addEventListener("install", function () {
            self.skipWaiting();
        });

        self.addEventListener("activate", function (event) {
            event.waitUntil(self.clients.claim());
        });

        self.addEventListener("fetch", function (event) {
            var request = event.request;

            // 这类请求交给浏览器自己处理，插手会报错
            if (request.cache === "only-if-cached" && request.mode !== "same-origin") {
                return;
            }

            event.respondWith(
                fetch(request)
                    .then(function (response) {
                        // opaque 响应改不了头，原样放行
                        if (response.status === 0) return response;

                        var headers = new Headers(response.headers);
                        headers.set("Cross-Origin-Embedder-Policy", "require-corp");
                        headers.set("Cross-Origin-Opener-Policy", "same-origin");
                        headers.set("Cross-Origin-Resource-Policy", "cross-origin");

                        return new Response(response.body, {
                            status: response.status,
                            statusText: response.statusText,
                            headers: headers,
                        });
                    })
                    .catch(function (e) {
                        console.error("[coi] fetch 失败：", e);
                        return Response.error();
                    }),
            );
        });

        return;
    }

    // ============ 页面侧 ============

    /**
     * 和 zk.js 里完全一致的探测：能不能建 wasm 共享内存。
     *
     * 注意不要用 `crossOriginIsolated === true` 当判据。实测 Chrome 桌面版在
     * crossOriginIsolated=false、SharedArrayBuffer=undefined 的情况下，
     * 依然允许创建 wasm 共享内存，Aleo SDK 能完整跑真实 ZK。
     * 若按"是否隔离"来判断，Chrome 用户会白白吃一次多余的重载。
     */
    function canCreateSharedMemory() {
        try {
            if (typeof WebAssembly === "undefined" || !WebAssembly.Memory) return false;
            new WebAssembly.Memory({ initial: 1, maximum: 2, shared: true });
            return true;
        } catch (e) {
            return false;
        }
    }

    try {
        // 已经能建共享内存 → ZK 本来就能跑，不需要 SW，也就不需要重载。
        // 覆盖：本机 dev/preview、itch.io 勾了 SharedArrayBuffer、Netlify、
        //       以及 Chrome 桌面版的宽松非隔离环境。
        if (canCreateSharedMemory()) {
            return;
        }

        // 手动关闭开关
        if (window.__coiDisable === true) return;
        if (location.search.indexOf("nocoi=1") !== -1) return;

        if (!("serviceWorker" in navigator)) {
            console.warn("[coi] 浏览器不支持 Service Worker，ZK 将走本地降级");
            return;
        }

        // 不安全上下文（http:// 非 localhost）注册不了 SW
        if (!window.isSecureContext) {
            console.warn("[coi] 非安全上下文，无法注册 Service Worker，ZK 将走本地降级");
            return;
        }

        // 每个标签页只允许重载一次，杜绝死循环
        var alreadyReloaded = false;
        try {
            alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === "1";
        } catch (e) {
            /* 隐私模式下 sessionStorage 可能不可用，当作已重载处理更安全 */
            alreadyReloaded = true;
        }

        if (alreadyReloaded) {
            console.warn("[coi] 已尝试过恢复跨源隔离但未成功，本次不再重载，ZK 走本地降级");
            return;
        }

        // 用当前脚本自身的 URL 注册，作用域自动跟随部署子目录
        var swUrl =
            (document.currentScript && document.currentScript.src) ||
            new URL("./coi-serviceworker.js", location.href).href;

        navigator.serviceWorker.register(swUrl).then(
            function (registration) {
                var reload = function () {
                    try {
                        sessionStorage.setItem(RELOAD_FLAG, "1");
                    } catch (e) {
                        /* ignore */
                    }
                    console.log("[coi] Service Worker 已就位，重载以启用跨源隔离…");
                    window.location.reload();
                };

                if (registration.active && !navigator.serviceWorker.controller) {
                    reload();
                    return;
                }

                registration.addEventListener("updatefound", function () {
                    var worker = registration.installing;
                    if (!worker) return;
                    worker.addEventListener("statechange", function () {
                        if (worker.state === "activated") reload();
                    });
                });
            },
            function (err) {
                console.warn("[coi] Service Worker 注册失败，ZK 走本地降级：", err);
            },
        );
    } catch (e) {
        console.warn("[coi] 恢复跨源隔离时异常，ZK 走本地降级：", e);
    }
})();
