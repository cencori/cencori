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
/**
 * The answer's whole budget, thinking included. The helper model reasons before it answers and the
 * gateway has no way to turn that off for it, so a small cap is spent thinking and the answer comes
 * back empty (`finish_reason: "length"`, `content: ""`): that is how a 200 cap broke every
 * suggestion and title. The answer itself is held to one line by the prompt, not by this.
 */
export const HELPER_MAX_TOKENS = 1_024;
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
 * The model, the token budget and the absence of tools and streaming are all set here, so a
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
  const { messages } = parsed as { messages?: unknown };
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_HELPER_MESSAGES) {
    return null;
  }
  if (!messages.every(isHelperMessage)) return null;
  return JSON.stringify({
    model: HELPER_MODEL,
    messages: messages.map(({ role, content }) => ({ role, content })),
    // Fixed, not the client's: a smaller ask leaves no room to answer after thinking.
    max_tokens: HELPER_MAX_TOKENS,
    stream: false,
    user: userId,
  });
}
