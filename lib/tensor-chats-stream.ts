/**
 * Reading a plain chat's streamed answer: its words, and the web searches it asks for
 * (app/api/tensor/chats/[chatId]/messages). Kept here so it can be tested; a route file may only
 * export its handlers.
 */

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

/** The streamed answer, piece by piece: its words as they come, then any searches it asks for. */
export async function* readStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<{ kind: "text"; text: string } | { kind: "call"; call: ToolCall }> {
  const reader = body.getReader();
  // Stopping cancels the stream itself, so the model stops generating, not only the reading.
  const stop = () => void reader.cancel().catch(() => {});
  signal.addEventListener("abort", stop);
  const decoder = new TextDecoder();
  let buffer = "";
  // Tool calls may arrive whole or in pieces; either way they are put together by their index.
  const calls = new Map<number, ToolCall>();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (signal.aborted) throw new Error("stopped");
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let end = buffer.indexOf("\n");
      while (end !== -1) {
        const raw = buffer.slice(0, end).trim();
        buffer = buffer.slice(end + 1);
        end = buffer.indexOf("\n");
        if (!raw.startsWith("data:")) continue;
        const data = raw.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        let parsed: {
          choices?: {
            delta?: {
              content?: unknown;
              tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[];
            };
          }[];
          error?: { message?: unknown };
        };
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }
        if (parsed.error) throw new Error(String(parsed.error.message ?? "upstream_error"));
        const delta = parsed.choices?.[0]?.delta;
        if (typeof delta?.content === "string" && delta.content) yield { kind: "text", text: delta.content };
        for (const piece of delta?.tool_calls ?? []) {
          const index = piece.index ?? calls.size;
          const call = calls.get(index) ?? { id: "", type: "function" as const, function: { name: "", arguments: "" } };
          if (piece.id) call.id = piece.id;
          if (piece.function?.name) call.function.name += piece.function.name;
          if (piece.function?.arguments) call.function.arguments += piece.function.arguments;
          calls.set(index, call);
        }
      }
    }
  } finally {
    signal.removeEventListener("abort", stop);
    reader.releaseLock();
  }
  for (const [index, call] of [...calls.entries()].sort(([a], [b]) => a - b)) {
    yield { kind: "call", call: { ...call, id: call.id || `call_${index}` } };
  }
}

/** The search a tool call asks for, or null when it is not one. */
export function searchQuery(call: ToolCall): string | null {
  if (call.function.name !== "web_search") return null;
  try {
    const args = JSON.parse(call.function.arguments || "{}") as { query?: unknown };
    const query = typeof args.query === "string" ? args.query.trim().slice(0, 300) : "";
    return query || null;
  } catch {
    return null;
  }
}

