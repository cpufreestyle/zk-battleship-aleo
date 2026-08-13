import {
  Account,
  ProgramManager,
} from "@provablehq/sdk";

// 注意：不要调用 initThreadPool()。它在独立 Worker 上下文里会挂起
// （60s 超时），主线程那条成功的路径也从未调用它。ProgramManager
// 单线程执行 verify_hit / verify_victory 完全够用，且初始化 <200ms。

let programManager = null;
let account = null;

onmessage = async function (e) {
  const { type, ships, mask, hits } = e.data || {};

  // 主线程在收到本 worker 的 ready 后才发 init，避免消息竞态
  if (type === "init") {
    try {
      programManager = new ProgramManager();
      account = new Account();
      programManager.setAccount(account);
      postMessage({
        type: "init_result",
        address: account.address().toString(),
      });
    } catch (error) {
      postMessage({ type: "error", message: error && error.message, originalType: type });
    }
    return;
  }

  if (!programManager) {
    postMessage({ type: "error", message: "ZK engine not initialized", originalType: type });
    return;
  }

  // 输出保持 u32，与 main.js 的 parseInt(result[0]) 契约一致：
  // verify_hit 返回 (ships & mask)，非零即命中；verify_victory 返回 (ships & hits)，
  // 等于 ships 即全歼。命中判定在主线程与 worker 两种路径下完全一致。
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

  try {
    if (type === "verify_hit") {
      const res = await programManager.run(
        SHADOWFLEET_PROGRAM,
        "verify_hit",
        [`${ships}u32`, `${mask}u32`],
        false,
      );
      postMessage({ type: "verify_hit_result", result: res.getOutputs() });
    } else if (type === "verify_victory") {
      const res = await programManager.run(
        SHADOWFLEET_PROGRAM,
        "verify_victory",
        [`${ships}u32`, `${hits}u32`],
        false,
      );
      postMessage({ type: "verify_victory_result", result: res.getOutputs() });
    } else if (type === "verify_scan") {
      const res = await programManager.run(
        SHADOWFLEET_PROGRAM,
        "verify_scan",
        [`${ships}u32`, `${mask}u32`],
        false,
      );
      postMessage({ type: "verify_scan_result", result: res.getOutputs() });
    }
  } catch (error) {
    postMessage({ type: "error", message: error && error.message, originalType: type });
  }
};

// 绑定好 onmessage 后通知主线程，主线程据此再发 init（握手，消除竞态）
postMessage({ type: "ready" });
