/**
 * Deploy shadowfleet.aleo to Aleo testnet
 * 
 * Prerequisites:
 * 1. Get testnet credits from https://faucet.aleo.org
 * 2. Save your private key (from Leo Wallet or generated via SDK)
 * 
 * Usage:
 *   node deploy.js <your_private_key>
 * 
 * Example:
 *   node deploy.js APrivateKey1234...
 */

import { Account, AleoNetworkClient, NetworkRecordProvider, ProgramManager, AleoKeyProvider } from "@provablehq/sdk";

const PROGRAM = `
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
`;

const privateKey = process.argv[2];

if (!privateKey) {
  console.error("❌ Usage: node deploy.js <your_private_key>");
  console.error("   Get testnet credits first: https://faucet.aleo.org");
  console.error("   Generate a key: node -e \"import('@provablehq/sdk').then(m => console.log(new m.Account().privateKey().toString()))\"");
  process.exit(1);
}

async function main() {
  console.log("=== Shadow Fleet Deployment ===\n");

  // Create account from private key
  const account = new Account({ privateKey });
  console.log("Account address:", account.address().toString());

  // Connect to testnet
  const networkClient = new AleoNetworkClient("https://api.provable.com/v2");
  const keyProvider = new AleoKeyProvider();
  keyProvider.useCache(true);
  const recordProvider = new NetworkRecordProvider(account, networkClient);

  const programManager = new ProgramManager(
    "https://api.provable.com/v2",
    keyProvider,
    recordProvider
  );
  programManager.setAccount(account);

  // Check balance
  try {
    const balance = await networkClient.getBalance(account.address().toString());
    console.log("Balance:", balance, "microcredits");
    if (balance < 2000000) {
      console.error("❌ Insufficient balance. Need at least 2 credits for deployment.");
      console.error("   Get credits from: https://faucet.aleo.org");
      process.exit(1);
    }
  } catch (e) {
    console.warn("⚠ Could not check balance:", e.message);
  }

  // Deploy
  console.log("\nDeploying shadowfleet.aleo to Aleo testnet...");
  const fee = 1.9; // 1.9 Aleo credits

  try {
    const tx_id = await programManager.deploy(PROGRAM, fee);
    console.log("\n✅ Deployed successfully!");
    console.log("   Transaction ID:", tx_id);
    console.log("   Program ID: shadowfleet.aleo");
    console.log("   Explorer: https://aleo.network/transaction/" + tx_id);
  } catch (e) {
    console.error("\n❌ Deployment failed:", e.message);
    process.exit(1);
  }
}

main().catch(console.error);
