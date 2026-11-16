/**
 * A project chat's conversation as the page shows it, kept in Cencori so the chat can be read
 * while its sandbox is not running (database/brimble/2500_tensor_cloud_chat_history.sql). The page
 * sends it whole when a turn ends; it is cleaned here to the parts the page draws, each cut to a
 * size, and the oldest are let go of when the whole would be too large.
 */

export type HistoryItem =
  | { type: "userMessage"; id: string; content: Array<{ type: "text"; text: string }> }
  | { type: "agentMessage"; id: string; text: string }
  | { type: "reasoning"; id: string; text: string; seconds?: number }
  | { type: "commandExecution"; id: string; command: string; status: string; exitCode: number | null; aggregatedOutput: string | null }
  | { type: "fileChange"; id: string; status: string; changes: Array<{ path: string; kind: { type: string } }> };

const MAX_ITEMS = 600;
const MAX_TEXT = 40_000;
const MAX_THOUGHT = 6_000;
const MAX_OUTPUT = 2_000;
const MAX_BYTES = 1_500_000;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

/** The end of a command's output, which is where what went wrong is said. */
function tail(value: unknown, max: number): string | null {
  return typeof value === "string" ? value.slice(-max) : null;
}

function cleanItem(raw: unknown): HistoryItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const id = text(item.id, 200);
  if (!id) return null;
  switch (item.type) {
    case "userMessage": {
      const parts = Array.isArray(item.content) ? item.content : [];
      const said = parts
        .map((part) => (part && typeof part === "object" ? text((part as Record<string, unknown>).text, MAX_TEXT) : ""))
        .join("")
        .slice(0, MAX_TEXT);
      return { type: "userMessage", id, content: [{ type: "text", text: said }] };
    }
    case "agentMessage":
      return { type: "agentMessage", id, text: text(item.text, MAX_TEXT) };
    case "reasoning": {
      const seconds = typeof item.seconds === "number" && Number.isFinite(item.seconds) ? Math.round(item.seconds) : undefined;
      return { type: "reasoning", id, text: text(item.text, MAX_THOUGHT), ...(seconds ? { seconds } : {}) };
    }
    case "commandExecution":
      return {
        type: "commandExecution",
        id,
        command: text(item.command, 2_000),
        status: text(item.status, 40) || "completed",
        exitCode: typeof item.exitCode === "number" ? item.exitCode : null,
        aggregatedOutput: tail(item.aggregatedOutput, MAX_OUTPUT),
      };
    case "fileChange": {
      const changes = (Array.isArray(item.changes) ? item.changes : [])
        .slice(0, 200)
        .map((change) => {
          const one = (change ?? {}) as Record<string, unknown>;
          const kind = (one.kind ?? {}) as Record<string, unknown>;
          return { path: text(one.path, 500), kind: { type: text(kind.type, 20) || "update" } };
        })
        .filter((change) => change.path);
      return { type: "fileChange", id, status: text(item.status, 40) || "completed", changes };
    }
    default:
      return null;
  }
}

/** What is kept of a conversation the page sent: the parts it draws, newest last, within bounds. */
export function cleanHistory(raw: unknown): HistoryItem[] {
  const items = (Array.isArray(raw) ? raw : []).map(cleanItem).filter((item): item is HistoryItem => item !== null).slice(-MAX_ITEMS);
  // The oldest go first when the whole is too large.
  let size = JSON.stringify(items).length;
  let from = 0;
  while (size > MAX_BYTES && from < items.length - 1) {
    size -= JSON.stringify(items[from]).length + 1;
    from += 1;
  }
  return items.slice(from);
}
