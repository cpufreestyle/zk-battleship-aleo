/**
 * Shadow Fleet — ZK 运行时接入层
 *
 * ============================================================
 *  为什么这个文件长这样：COOP/COEP 降级策略
 * ============================================================
 *
 * @provablehq/wasm 的 glue 代码里写死了这一行：
 *
 *     imports.wbg.memory = memory ||
 *         new WebAssembly.Memory({initial:168, maximum:65536, shared:true});
 *
 * `shared:true` 是**无条件**的 —— 不是只有开线程池才需要。浏览器只在
 * crossOriginIsolated（即响应头带 COOP:same-origin + COEP:require-corp）
 * 的页面里才允许创建共享内存，否则这一行直接抛 TypeError。
 *
 * 更糟的是，同一个文件在模块顶层就 `await __wbg_init(...)`，也就是
 * **import 即执行**。所以在没有隔离的环境里：
 *
 *     main.js --import--> zk.js --静态 import--> @provablehq/sdk --> 抛错
 *
 * ESM 里依赖模块求值失败会让整条 import 链一起失败，main.js 根本不会执行，
 * 结果是**整页白屏**，而不是"ZK 降级、游戏照玩"。
 *
 * itch.io 不勾 SharedArrayBuffer 选项、GitHub Pages、CloudStudio 这类
 * 不能自定义响应头的静态托管，全部命中这个白屏。
 *
 * 因此本文件的策略是三层：
 *
 *   L1  能力探测：用和 SDK 完全相同的方式试建一块共享内存。
 *   L2  只有探测通过才 **动态** import SDK。动态 import 让它进独立 chunk，
 *       既不进首屏关键路径，失败也能被 catch，不会带崩 main.js。
 *   L3  探测不过 / 加载失败 / 超时 → 干净地派发 zk-error，游戏走
 *       main.js 里已有的本地校验分支。永不白屏、永不卡死。
 *
 * 对 main.js 的契约保持完全不变：
 *   window.__zkExecute(fn, inputs) / window.__zkReady / window.__zkAddress
 *   + "zk-ready" / "zk-error" 事件
 */

// ZK program in Aleo Instructions format
// verify_hit: private ships bitstring + public mask → proves hit/miss without revealing ships
// verify_victory: private ships + public hits → proves all ships sunk without revealing positions
// verify_scan: private ships + public scan-area mask → returns count of ships in area WITHOUT revealing which cells
const SHADOWFLEET_PROGRAM = `
program shadowfleet.aleo;

function verify_hit:
    input r0 as u32.private;
    input r1 as u32.public;
    and r0 r1 into r2;
    output r2 as u32.private;

function verify_victory:
    input r0 as u32.private;
    input r1 as u32.public;
    and r0 r1 into r2;
    output r2 as u32.private;

function verify_scan:
    input r0 as u32.private;
    input r1 as u32.public;
    and r0 r1 into r2;
    output r2 as u32.private;
`;

// ZK 引擎加载超时（首次要拉 ~21MB wasm，慢网需要宽限）
const INIT_TIMEOUT_MS = 60_000;
// 单次证明超时。超时即抛错，main.js 会 catch 并落到本地校验，绝不能让回合卡死
const EXEC_TIMEOUT_MS = 20_000;

let zkReady = false;
let programManager = null;
let account = null;

/**
 * 全局诊断信息 —— 给 UI / 发布阶段读，用来对玩家讲实话
 * mode: "probing" | "zk" | "fallback"
 */
const diag = {
    mode: "probing",
    crossOriginIsolated: false,
    sharedMemory: false,
    reason: "",
    engineLoadMs: 0,
};
window.__zkDiag = diag;

/**
 * L1 —— 能力探测
 *
 * 【实测结论，别想当然】
 * 直觉上会写 `typeof SharedArrayBuffer !== "undefined"` 或
 * `crossOriginIsolated === true` 来判断。**两个都是错的，会误杀 Chrome。**
 *
 * 在 Chrome 桌面版非隔离页面里实测（headless Chrome，本项目构建产物）：
 *     crossOriginIsolated      = false
 *     typeof SharedArrayBuffer = "undefined"
 *     但 new WebAssembly.Memory({shared:true}) —— 成功
 *     SDK 完整加载、ProgramManager 构造成功、
 *     verify_hit(7,1) 真实 ZK 执行成功 → ["1u32"]，耗时 20ms
 *
 * 也就是说 Chrome 隐藏了 SharedArrayBuffer 全局构造器，却仍然允许 wasm
 * 共享内存。SDK 只用后者，不碰前者。Firefox / Safari 则两者都拒绝。
 *
 * 所以唯一正确的探测方式是：**照抄 SDK 那一行，试着建一块最小共享内存**。
 * 不多不少，正好等价于"SDK 能不能跑"。
 */
function probeSharedMemory() {
    diag.crossOriginIsolated = globalThis.crossOriginIsolated === true;

    // QA 开关：?zk=off 强制走降级路径。
    // 发布前用它在**任意**托管环境上验证"没有真 ZK 时游戏依然完整可玩"，
    // 不用去翻浏览器设置或找台 Safari。?zk=on 则跳过探测强行尝试加载。
    let force = "";
    try {
        force = new URLSearchParams(location.search).get("zk") || "";
    } catch (e) {
        /* 某些沙箱环境读不到 location，忽略 */
    }
    if (force === "off") {
        diag.reason = "已通过 ?zk=off 强制降级（QA 模式）";
        return false;
    }
    if (force === "on") {
        diag.sharedMemory = true;
        diag.reason = "已通过 ?zk=on 跳过能力探测（QA 模式）";
        return true;
    }

    try {
        if (typeof WebAssembly === "undefined" || !WebAssembly.Memory) {
            diag.reason = "WebAssembly.Memory 不可用";
            return false;
        }

        // 和 @provablehq/wasm 内部完全一致的调用方式，只是尺寸取最小
        new WebAssembly.Memory({ initial: 1, maximum: 2, shared: true });

        diag.sharedMemory = true;
        return true;
    } catch (e) {
        // Firefox / Safari 非隔离环境走这里
        diag.reason = `wasm 共享内存被拒绝：${e && e.message ? e.message : e}`;
        return false;
    }
}

/** 给 Promise 套一个超时，避免任何一步无限挂起 */
function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} 超时（${ms}ms）`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * 事件必须延后派发。
 * zk.js 是被 main.js 静态 import 的，main.js 的事件监听器在自身模块体末尾
 * 才注册。同步派发会被漏听。丢到宏任务队列可确保监听器已就位。
 */
function emitLater(event) {
    setTimeout(() => window.dispatchEvent(event), 0);
}

function failToFallback(reason) {
    zkReady = false;
    programManager = null;
    diag.mode = "fallback";
    if (reason) diag.reason = reason;
    window.__zkReady = false;
    console.warn(`[ZK] 走本地降级校验：${diag.reason}`);
    emitLater(new CustomEvent("zk-error", { detail: diag.reason }));
}

/**
 * L2 —— 探测通过才动态加载 SDK
 */
async function initZK() {
    const t0 = performance.now();

    if (!probeSharedMemory()) {
        // 关键：这里**根本不去 import** SDK。
        // 静态 import 会在模块求值阶段抛错并带崩 main.js（白屏）；
        // 连动态 import 都跳过，等 coi-serviceworker 把页面救成隔离态后重载，
        // 届时探测会通过、再走真实 ZK 路径。若连 SW 都救不了 → 纯降级。
        failToFallback();
        return;
    }

    try {
        console.log(
            `[ZK] wasm 共享内存可用（crossOriginIsolated=${diag.crossOriginIsolated}），开始加载 Aleo 引擎…`,
        );

        // 动态 import：独立 chunk + 失败可捕获
        const { Account, ProgramManager } = await withTimeout(
            import("@provablehq/sdk"),
            INIT_TIMEOUT_MS,
            "Aleo 引擎加载",
        );

        programManager = new ProgramManager();
        account = new Account();
        programManager.setAccount(account);

        const addr = account.address().toString();
        zkReady = true;
        diag.mode = "zk";
        diag.reason = "真实 ZK 证明已启用";
        diag.engineLoadMs = Math.round(performance.now() - t0);

        window.__zkReady = true;
        window.__zkAddress = addr;
        console.log(`[ZK] 引擎就绪（${diag.engineLoadMs}ms），地址：`, addr);
        emitLater(new Event("zk-ready"));
    } catch (e) {
        failToFallback(`Aleo 引擎加载失败：${e && e.message ? e.message : e}`);
    }
}

/**
 * 执行一次本地 ZK 证明。
 * 契约与旧版一致：返回 outputs 数组；失败抛错由 main.js 兜底。
 */
window.__zkExecute = async function (functionName, inputs) {
    if (!zkReady || !programManager) throw new Error("ZK engine not ready");

    try {
        const response = await withTimeout(
            programManager.run(SHADOWFLEET_PROGRAM, functionName, inputs, false),
            EXEC_TIMEOUT_MS,
            `ZK 证明 ${functionName}`,
        );
        return response.getOutputs();
    } catch (e) {
        console.error(`[ZK] 执行失败 ${functionName}:`, e && e.message ? e.message : e);
        // 一旦执行失败就永久降级，避免后续每回合都重试并拖慢节奏
        diag.mode = "fallback";
        diag.reason = "ZK 执行失败，已切到本地校验";
        throw e;
    }
};

// 初始状态先声明为未就绪，防止 main.js 读到 undefined
window.__zkReady = false;

initZK();
