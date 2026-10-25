/**
 * Helper calls: the small model calls Tensor makes around a task rather than in one, such as the
 * prompt it suggests next and the task's title.
 *
 * They run between turns, when no reservation exists, so they cannot go through the plan check a
 * turn's calls do. They are held instead to one cheap model, a short answer, plain chat with no
 * tools, and a daily count per user, which keeps each to a fraction of a cent and never spends a
 * task.
 */

/** The one model helper calls run on, whatever they ask for. */
export const HELPER_MODEL = process.env.TENSOR_HELPER_MODEL?.trim() || "deepseek-v4-flash";
/** Enough for a title or a one-line prompt; a helper that needs more is not a helper. */
export const HELPER_MAX_TOKENS = 200;
/** Per user per UTC day. A suggestion after every turn of a busy day stays well inside it. */
export const HELPER_DAILY_LIMIT = Number(process.env.TENSOR_HELPER_DAILY_LIMIT) || 400;
/** Messages a helper may send: a system prompt, a short exchange, the ask. */
const MAX_HELPER_MESSAGES = 12;

type HelperMessage = { role: "system" | "user" | "assistant"; content: string };

function isHelperMessage(value: unknown): value is HelperMessage {
  if (!value || typeof value !== "object") return false;
  const { role, content } = value as { role?: unknown; content?: unknown };
  return (
    (role === "system" || role === "user" || role === "assistant") && typeof content === "string"
  );
}

/**
 * A helper request as the gateway will see it: the caller's messages and nothing else they chose.
 *
 * The model, the answer's length and the absence of tools and streaming are all set here, so a
 * client cannot turn a free helper call into a free turn. Null when the body is not a plain chat
 * request this route will carry.
 */
export function helperBody(raw: string, userId: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const { messages, max_tokens: requested } = parsed as { messages?: unknown; max_tokens?: unknown };
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_HELPER_MESSAGES) {
    return null;
  }
  if (!messages.every(isHelperMessage)) return null;
  const asked = Number(requested);
  return JSON.stringify({
    model: HELPER_MODEL,
    messages: messages.map(({ role, content }) => ({ role, content })),
    max_tokens:
      Number.isFinite(asked) && asked > 0 ? Math.min(Math.floor(asked), HELPER_MAX_TOKENS) : HELPER_MAX_TOKENS,
    stream: false,
    user: userId,
  });
}
