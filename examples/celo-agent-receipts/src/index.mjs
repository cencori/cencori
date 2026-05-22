import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCencoriAgent } from "./cencori-agent.mjs";
import { recordReceiptOnCelo } from "./celo-record.mjs";
import { createReceipt, hashReceipt, stableJson } from "./receipt.mjs";
import { loadEnv, readEnv, readOptionalAgentId } from "./env.mjs";

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, "../output");

const agentId = readOptionalAgentId();
const externalRunId = `cencori-celo-${Date.now()}`;
const task =
  "Write a short market brief explaining why Cencori and Celo together matter for production agents that can safely move money.";

const startedAt = new Date().toISOString();

const result = await runCencoriAgent({
  apiKey: readEnv("CENCORI_API_KEY"),
  baseUrl: readEnv("CENCORI_BASE_URL", "https://api.cencori.com/v1"),
  agentId,
  model: readEnv("CENCORI_MODEL", "claude-sonnet-4-5"),
  task,
  externalRunId,
});

const completedAt = new Date().toISOString();

const receipt = createReceipt({
  agentId,
  agentName: agentId ? "Cencori x Celo Research Agent" : "Cencori project agent",
  model: readEnv("CENCORI_MODEL", "claude-sonnet-4-5"),
  externalRunId,
  task,
  status: "completed",
  startedAt,
  completedAt,
  outputPreview: result.content.slice(0, 500),
  usage: result.usage,
  controls: {
    shadow_mode: true,
    approval_required: false,
    max_spend_usd: readEnv("DEMO_MAX_SPEND_USD", "0.10"),
    cencori_request_id: result.requestId,
    cencori_response_simulated: result.simulated,
  },
  celo: {
    chain_id: 11142220,
    payment_token: readEnv("DEMO_PAYMENT_TOKEN", "USDC"),
    payment_amount: readEnv("DEMO_PAYMENT_AMOUNT", "0.05"),
    payee: readEnv("DEMO_PAYEE_ADDRESS", ""),
    payment_settled_onchain: false,
    payment_note:
      "payment_* fields are receipt metadata only; onchain tx is recordRun(receiptHash), not a token transfer",
  },
});

const receiptHash = hashReceipt(receipt);

fs.mkdirSync(outputDir, { recursive: true });
const receiptPath = path.join(outputDir, `${externalRunId}.json`);
fs.writeFileSync(receiptPath, `${stableJson({ ...receipt, receipt_hash: receiptHash })}\n`);

const onchain = await recordReceiptOnCelo({
  rpcUrl: readEnv("CELO_RPC_URL", "https://forno.celo-sepolia.celo-testnet.org"),
  privateKey: readEnv("CELO_PRIVATE_KEY"),
  contractAddress: readEnv("CELO_RECEIPTS_CONTRACT"),
  receiptHash,
  externalRunId,
  receiptURI: `file://${receiptPath}`,
});

const explorerBase = readEnv("CELO_EXPLORER_URL", "https://celo-sepolia.blockscout.com");
const explorerUrl = onchain.txHash ? `${explorerBase.replace(/\/+$/, "")}/tx/${onchain.txHash}` : null;

console.log("");
console.log("Cencori x Celo Agent Receipt Demo");
console.log("---------------------------------");
console.log(`Run: ${externalRunId}`);
console.log(`Cencori request: ${result.requestId}`);
console.log(`Receipt hash: ${receiptHash}`);
console.log(`Receipt file: ${receiptPath}`);
console.log(`Onchain recorded: ${onchain.simulated ? "no (simulation mode)" : "yes"}`);
if (onchain.message) console.log(`Note: ${onchain.message}`);
if (explorerUrl) console.log(`Celo explorer: ${explorerUrl}`);
console.log(
  "Payment fields in receipt JSON are metadata only (no USDC transfer in this starter)."
);
console.log("");
console.log("Agent output preview:");
console.log(result.content.slice(0, 800));
console.log("");
