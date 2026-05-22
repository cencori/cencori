export async function runCencoriAgent({
  apiKey,
  baseUrl,
  agentId,
  model,
  task,
  externalRunId,
}) {
  if (!apiKey) {
    return {
      simulated: true,
      requestId: `sim_${Date.now()}`,
      content:
        "Simulated Cencori response: Celo gives agents stablecoin payments, identity, reputation, and low-cost settlement. Cencori gives those agents routing, traces, approvals, budgets, and security.",
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        estimated_cost_usd: "0.00",
      },
    };
  }

  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(agentId ? { "X-Agent-ID": agentId } : {}),
      "X-Cencori-Trace-ID": externalRunId,
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: "system",
          content:
            "You are a concise research agent. Produce a useful market brief with practical partnership implications.",
        },
        {
          role: "user",
          content: task,
        },
      ],
      metadata: {
        demo: "cencori-celo-agent-receipts",
        external_run_id: externalRunId,
      },
    }),
  });

  const requestId =
    response.headers.get("x-request-id") ||
    response.headers.get("x-cencori-request-id") ||
    `req_${Date.now()}`;

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Cencori request failed (${response.status}): ${body.slice(0, 500)}`);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content || "";
  const usage = json?.usage || {};

  return {
    simulated: false,
    requestId,
    content,
    usage: {
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      total_tokens: usage.total_tokens || 0,
      estimated_cost_usd: String(json?.cost_usd || "0.00"),
    },
  };
}
