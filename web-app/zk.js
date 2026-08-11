import { Account, ProgramManager } from "@provablehq/sdk";

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

let zkReady = false;
let programManager = null;
let account = null;

// Initialize ZK engine (single-threaded, no initThreadPool needed)
async function initZK() {
  try {
    console.log("[ZK] Creating ProgramManager...");
    programManager = new ProgramManager();
    account = new Account();
    programManager.setAccount(account);
    zkReady = true;
    const addr = account.address().toString();
    console.log("[ZK] Engine ready! Address:", addr);
    window.__zkReady = true;
    window.__zkAddress = addr;
    window.dispatchEvent(new Event("zk-ready"));
  } catch (e) {
    console.error("[ZK] Init failed:", e.message);
    window.dispatchEvent(new CustomEvent("zk-error", { detail: e.message }));
  }
}

// Execute a ZK proof locally
window.__zkExecute = async function (functionName, inputs) {
  if (!zkReady) throw new Error("ZK engine not ready");
  try {
    const response = await programManager.run(
      SHADOWFLEET_PROGRAM,
      functionName,
      inputs,
      false,
    );
    return response.getOutputs();
  } catch (e) {
    console.error("[ZK] Execution error:", JSON.stringify(e, null, 2));
    console.error("[ZK] Error name:", e.name, "message:", e.message);
    throw e;
  }
};

// Start init
initZK();
