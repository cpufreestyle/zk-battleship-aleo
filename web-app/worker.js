import {
  Account,
  ProgramManager,
  initThreadPool,
} from "@provablehq/sdk";

// Set up message handler BEFORE async init
let programManager = null;
let account = null;

onmessage = async function (e) {
  const { type, ships, mask, hits, shots } = e.data;

  // Wait for init if not ready yet
  if (type === "init") {
    try {
      await initThreadPool();
      programManager = new ProgramManager();
      account = new Account();
      programManager.setAccount(account);
      console.log("Aleo ZK engine initialized, address:", account.address());
      postMessage({
        type: "init_result",
        address: account.address(),
      });
    } catch (error) {
      console.error("ZK init error:", error.message);
      postMessage({ type: "error", message: error.message, originalType: type });
    }
    return;
  }

  if (!programManager) {
    postMessage({ type: "error", message: "ZK engine not initialized", originalType: type });
    return;
  }

  const SHADOWFLEET_PROGRAM = `
program shadowfleet.aleo;

function verify_hit:
    input r0 as u32.private;
    input r1 as u32.public;
    and r0 r1 into r2;
    ne r2 0u32 into r3;
    output r3 as bool.private;

function verify_victory:
    input r0 as u32.private;
    input r1 as u32.public;
    and r0 r1 into r2;
    eq r2 r0 into r3;
    output r3 as bool.private;
`;

  try {
    if (type === "verify_hit") {
      const executionResponse = await programManager.run(
        SHADOWFLEET_PROGRAM,
        "verify_hit",
        [`${ships}u32`, `${mask}u32`],
        false,
      );
      const result = executionResponse.getOutputs();
      postMessage({ type: "verify_hit_result", result });
    } else if (type === "verify_victory") {
      const executionResponse = await programManager.run(
        SHADOWFLEET_PROGRAM,
        "verify_victory",
        [`${ships}u32`, `${hits}u32`],
        false,
      );
      const result = executionResponse.getOutputs();
      postMessage({ type: "verify_victory_result", result });
    }
  } catch (error) {
    console.error(`ZK execution error (${type}):`, error.message);
    postMessage({ type: "error", message: error.message, originalType: type });
  }
};
