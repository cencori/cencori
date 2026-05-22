import crypto from "node:crypto";

export function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function hashReceipt(receipt) {
  const canonical = stableJson(receipt);
  const digest = crypto.createHash("sha256").update(canonical).digest("hex");
  return `0x${digest}`;
}

export function createReceipt({
  agentId,
  agentName,
  model,
  externalRunId,
  task,
  status,
  startedAt,
  completedAt,
  outputPreview,
  usage,
  controls,
  celo,
}) {
  return {
    type: "cencori.agent_run_receipt",
    version: "0.1",
    network: "celo-sepolia",
    agent: {
      cencori_agent_id: agentId,
      name: agentName,
      model,
    },
    run: {
      external_run_id: externalRunId,
      task,
      status,
      started_at: startedAt,
      completed_at: completedAt,
      output_preview: outputPreview,
    },
    usage,
    controls,
    celo,
  };
}
