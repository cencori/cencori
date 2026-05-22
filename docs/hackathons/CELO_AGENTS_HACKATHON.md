# Cencori x Celo Agents Hackathon Guide

Status: Standalone hackathon guide  
Audience: Celo hackathon builders using Cencori Agents  
Last updated: 2026-05-22  

## The Goal

Build an agent that runs through Cencori and can optionally record proof of the run on Celo Sepolia.

The product hierarchy is simple:

```text
Cencori = agent infrastructure
Celo = onchain economy and proof layer
```

Cencori handles the AI side: model routing, agent identity, logs, security, usage, cost, and billing infrastructure.

Celo handles the onchain side: stablecoin payments, receipts, identity, reputation, and low-cost settlement.

For the hackathon, the starter gives you a working pattern:

```text
Agent task -> Cencori Gateway -> Run receipt -> Optional Celo Sepolia receipt hash
```

## What You Will Build

By the end, you will have:

- A runnable Cencori-powered agent.
- A structured receipt for every agent run.
- A SHA-256 hash of that receipt.
- Optional Celo Sepolia onchain recording of the receipt hash.
- A clean base for adding x402 payments, MiniPay flows, or ERC-8004 reputation later.

## Prerequisites

Required:

- Node.js 18 or newer.
- npm, pnpm, yarn, or bun.

Optional for real Cencori model calls:

- A Cencori account.
- A Cencori project API key: `csk_...`.
- Provider access for the model you want to call.

Optional for Celo onchain recording:

- A Celo Sepolia wallet.
- Testnet funds for gas.
- A deployed `AgentRunReceipts` contract.

The first demo run does not require keys. It runs in simulation mode so you can start immediately.

## 1. Create The Starter

Run:

```bash
npx create-cencori-app my-celo-agent --template celo-agent
cd my-celo-agent
```

If the CLI asks to install dependencies, allow it. If you skipped installation, run:

```bash
npm install
```

## 2. Run The Demo Immediately

```bash
npm run demo
```

Expected simulation output:

```text
Cencori x Celo Agent Receipt Demo
---------------------------------
Run: cencori-celo-...
Cencori request: sim_...
Receipt hash: 0x...
Receipt file: .../output/cencori-celo-....json
Onchain recorded: no (simulation mode)
Note: Missing CELO_PRIVATE_KEY or CELO_RECEIPTS_CONTRACT. Receipt generated locally but not recorded onchain.
```

This proves the local agent flow works.

## 3. Understand The Generated Files

```text
my-celo-agent/
├── contracts/
│   └── AgentRunReceipts.sol
├── src/
│   ├── cencori-agent.mjs
│   ├── celo-record.mjs
│   ├── env.mjs
│   ├── index.mjs
│   └── receipt.mjs
├── .env
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

Important files:

- `src/index.mjs`: runs the full demo.
- `src/cencori-agent.mjs`: sends the agent task through Cencori or simulates without a key.
- `src/receipt.mjs`: creates canonical receipt JSON and hashes it.
- `src/celo-record.mjs`: records the receipt hash on Celo Sepolia when configured.
- `contracts/AgentRunReceipts.sol`: tiny event contract for receipt proof.
- `output/`: generated local receipts.

## 4. Add Cencori

Open `.env` and set:

```bash
CENCORI_API_KEY=csk_...
CENCORI_AGENT_ID=
CENCORI_BASE_URL=https://api.cencori.com/v1
CENCORI_MODEL=claude-sonnet-4-5
```

Notes:

- `CENCORI_API_KEY` is your project key from Cencori.
- `CENCORI_AGENT_ID` is optional. Use it if you created a dashboard agent and want requests scoped to it.
- `CENCORI_MODEL` can be any model enabled in your Cencori project.
- If you see a provider configuration error, your Cencori key works, but the selected model provider is not configured yet.

Run again:

```bash
npm run demo
```

Now the agent should call Cencori instead of returning the simulated response.

## 5. Deploy The Celo Receipt Contract

The generated contract is intentionally small:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

contract AgentRunReceipts {
    event AgentRunRecorded(
        bytes32 indexed receiptHash,
        string indexed externalRunId,
        address indexed recorder,
        string receiptURI
    );

    function recordRun(
        bytes32 receiptHash,
        string calldata externalRunId,
        string calldata receiptURI
    ) external {
        emit AgentRunRecorded(receiptHash, externalRunId, msg.sender, receiptURI);
    }
}
```

Deploy `contracts/AgentRunReceipts.sol` to Celo Sepolia.

Celo Sepolia details:

```text
Chain ID: 11142220
RPC: https://forno.celo-sepolia.celo-testnet.org
Explorer: https://celo-sepolia.blockscout.com
```

You can deploy with Remix, Foundry, Hardhat, or any Solidity deployment tool you prefer.

## 6. Enable Onchain Recording

After deploying the contract, update `.env`:

```bash
CELO_RPC_URL=https://forno.celo-sepolia.celo-testnet.org
CELO_PRIVATE_KEY=0x...
CELO_RECEIPTS_CONTRACT=0x...
CELO_EXPLORER_URL=https://celo-sepolia.blockscout.com
```

Then run:

```bash
npm run demo
```

Expected onchain output:

```text
Onchain recorded: yes
Celo explorer: https://celo-sepolia.blockscout.com/tx/0x...
```

## 7. What To Show Judges

Show these four things:

- The agent task running through Cencori.
- The generated receipt file in `output/`.
- The receipt hash printed in the terminal.
- The Celo Sepolia explorer transaction if you enabled onchain recording.

Strong demo sentence:

```text
This agent runs through Cencori for model routing, safety, observability, and spend control, then records proof of completed work on Celo.
```

## Real-World Use Cases

Use these as hackathon project ideas:

| Use case | What Cencori does | What Celo does |
| --- | --- | --- |
| Paid research agent | Runs the research agent and logs cost/output | Records proof of completed research and payment metadata |
| Refund agent | Applies safety, audit logs, and approval flows | Sends or records stablecoin refund activity |
| MiniPay support agent | Handles user support and AI reasoning | Connects to MiniPay-facing payment or wallet flows |
| x402 paid tool | Controls model/tool execution | Requires payment before serving a tool result |
| Agent reputation | Produces run receipts and outcome metadata | Anchors identity or reputation through onchain standards |
| AI contractor payout | Tracks task completion and output | Pays contributor or agent wallet after approval |

## Where x402, MiniPay, And ERC-8004 Fit

This starter focuses on receipts first because receipts are the simplest proof primitive.

Next layers:

- x402: use when an API, tool, or agent action should require payment before execution.
- MiniPay: use when the end user is a MiniPay wallet user.
- ERC-8004: use when your agent needs public identity, validation, or reputation.

Keep the stack clean:

```text
Cencori controls the agent run.
Celo proves and settles agent activity.
```

## Safety Rules

- Do not commit `.env`.
- Do not use a mainnet private key for hackathon testing.
- Use Celo Sepolia while building.
- Do not move real user funds without human approval.
- Keep full receipts in durable storage if you depend on the hash later.
- In production, use an HTTPS or IPFS receipt URI instead of a local `file://` path.

## Troubleshooting

| Problem | Meaning | Fix |
| --- | --- | --- |
| `Onchain recorded: no (simulation mode)` | Celo credentials are missing | Set `CELO_PRIVATE_KEY` and `CELO_RECEIPTS_CONTRACT` |
| `Cencori request: sim_...` | Cencori key is missing | Set `CENCORI_API_KEY` |
| Provider error from Cencori | The model provider is not configured | Add provider access in Cencori or switch models |
| Contract call fails | Wrong network, wrong contract, or no gas | Confirm Celo Sepolia, contract address, and wallet funds |
| No receipt file | Demo did not complete | Run `npm run demo` again and check terminal errors |
| Explorer link missing | Onchain recording was skipped | Add Celo env vars and rerun |

## Command Reference

```bash
# Create starter
npx create-cencori-app my-celo-agent --template celo-agent

# Enter project
cd my-celo-agent

# Install dependencies if needed
npm install

# Run demo
npm run demo

# Inspect generated receipts
ls output
```

## Submission Checklist

- The app runs with `npm run demo`.
- The project includes a clear agent use case.
- The terminal prints a receipt hash.
- `output/` contains at least one receipt JSON file.
- If using Celo, the demo prints a Celo Sepolia explorer link.
- The README or demo explains why both Cencori and Celo are used.

## Links

- Cencori: https://cencori.com
- Celo: https://celo.org
- Celo Sepolia Explorer: https://celo-sepolia.blockscout.com
- Celo Build with AI: https://docs.celo.org/build-on-celo/build-with-ai/overview
- ERC-8004: https://eips.ethereum.org/EIPS/eip-8004
- x402: https://www.x402.org
