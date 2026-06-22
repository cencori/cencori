import { loadAgent, type LoadedAgent } from "../loader.js";
import type { TurnContext, ToolCallContext } from "../types.js";

export interface RunOptions {
  endpoint?: string;
  apiKey?: string;
  maxTurns?: number;
}

export interface RunResult {
  output: string;
  turns: TurnContext[];
}

export async function runAgent(
  agentDir: string,
  input: string,
  options: RunOptions = {}
): Promise<RunResult> {
  const agent = await loadAgent(agentDir);
  const endpoint = options.endpoint || process.env.CENCORI_API_URL || "https://cencori.com/v1";
  const apiKey = options.apiKey || process.env.CENCORI_API_KEY || "";

  const model = agent.manifest.config.model;
  const instructions = agent.manifest.instructions;
  const tools = Object.entries(agent.manifest.tools).map(([name, tool]) => ({
    name,
    description: tool.description,
    inputSchema: tool.inputSchema?.description?.() ?? {},
  }));

  const response = await fetch(`${endpoint}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(agent.manifest.config.cencori?.project
        ? { "X-Project-ID": agent.manifest.config.cencori.project }
        : {}),
    },
    body: JSON.stringify({
      model,
      input,
      instructions,
      tools: tools.length > 0 ? tools : undefined,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cencori API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  const turn: TurnContext = {
    id: data.id ?? crypto.randomUUID(),
    sessionId: data.session_id,
    input,
    output: data.output_text ?? JSON.stringify(data),
  };

  return {
    output: turn.output ?? "",
    turns: [turn],
  };
}

export async function* streamAgent(
  agentDir: string,
  input: string,
  options: RunOptions = {}
): AsyncGenerator<string, void, unknown> {
  const agent = await loadAgent(agentDir);
  const endpoint = options.endpoint || process.env.CENCORI_API_URL || "https://cencori.com/v1";
  const apiKey = options.apiKey || process.env.CENCORI_API_KEY || "";

  const model = agent.manifest.config.model;
  const instructions = agent.manifest.instructions;

  const response = await fetch(`${endpoint}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input,
      instructions,
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cencori API error (${response.status}): ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const payload = line.slice(6);
        if (payload === "[DONE]") return;
        try {
          const parsed = JSON.parse(payload);
          if (parsed.type === "text" && parsed.delta) {
            yield parsed.delta;
          }
        } catch {
          // skip unparseable chunks
        }
      }
    }
  }
}
