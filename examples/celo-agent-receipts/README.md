# Cencori x Celo Agent Receipts

This is an integration example, not the foundation of the Cencori Agents product. The core product is Cencori-native agent infrastructure; Celo is layered on top for onchain payments, receipts, identity, and reputation.

This example demonstrates the partnership wedge:

```text
Celo gives agents economic agency.
Cencori gives agents production infrastructure.
```

The demo runs a Cencori-governed agent task, creates a structured receipt for the run, hashes that receipt, and optionally records the receipt hash on Celo Sepolia.

## What It Shows

- A Cencori agent can perform useful work through the Gateway.
- Cencori can produce a trace-style receipt for that work.
- Celo can store a verifiable onchain proof that the work happened.
- The same pattern can later attach x402 payments, ERC-8004 identity, and reputation.

## Files

- `contracts/AgentRunReceipts.sol` — tiny receipt event contract for Celo Sepolia.
- `src/cencori-agent.mjs` — calls Cencori Gateway or simulates if no API key is set.
- `src/receipt.mjs` — creates canonical JSON and hashes the run receipt.
- `src/celo-record.mjs` — records the receipt hash on Celo Sepolia when configured.
- `src/index.mjs` — end-to-end demo runner.

## Setup

```bash
cd examples/celo-agent-receipts
npm install
cp .env.example .env
```

Add at least:

```bash
CENCORI_API_KEY=your_cencori_key
# Optional — leave empty for project-key-only (do not use demo-agent):
# CENCORI_AGENT_ID=
```

For onchain recording, also add:

```bash
CELO_PRIVATE_KEY=your_celo_sepolia_private_key
CELO_RECEIPTS_CONTRACT=deployed_receipts_contract_address
```

If those Celo values are missing, the demo still generates a local receipt and runs in simulation mode for the onchain step.

## Run

```bash
npm run demo
```

Expected output:

```text
Cencori x Celo Agent Receipt Demo
---------------------------------
Run: cencori-celo-...
Cencori request: req_...
Receipt hash: 0x...
Receipt file: .../output/cencori-celo-....json
Onchain recorded: yes
Celo explorer: https://celo-sepolia.blockscout.com/tx/0x...
```

## Contract

The receipt contract intentionally does one thing:

```solidity
event AgentRunRecorded(
    bytes32 indexed receiptHash,
    string indexed externalRunId,
    address indexed recorder,
    string receiptURI
);
```

This is enough to prove that a Cencori agent run produced a receipt and that the receipt hash was anchored on Celo.

## Product Direction

This Celo integration can grow into:

- Celo wallet per Cencori agent.
- ERC-8004 agent registration.
- x402 payments for paid agent tools.
- Celo receipt links on Cencori agent run pages.
- Agent reputation updates from completed Cencori runs.
- MiniPay-facing agents for remittances, refunds, bill payments, and support.
