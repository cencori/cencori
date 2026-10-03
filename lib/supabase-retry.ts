import "server-only";

/**
 * Retry helper for Supabase server fetches.
 *
 * Production incident (2026-10-03 ~04:43-05:37 UTC): Vercel serverless ->
 * Supabase intermittently failed with:
 *   TypeError: fetch failed
 *   [cause]: UND_ERR_SOCKET (other side closed), ECONNRESET,
 *   "Client network socket disconnected before secure TLS"
 * to *.supabase.co:443. A single failure threw out of
 * getActiveConsoleWorkspace and took down /home, /login, /billing, /memory
 * ("Could not load console projects/organizations").
 *
 * PostgREST via supabase-js surfaces network blips as a returned
 * `{ error }` (not a throw) in most paths, but auth calls can throw, so
 * both shapes retry here. Auth/RLS denials (PGRST116, 401/403/400/404)
 * fail fast — retrying those burns budget for nothing.
 */

const TRANSIENT_MESSAGE = /fetch failed|network|timed?\s?out|timeout|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|UND_ERR_SOCKET|other side closed|socket disconnected|TLS|EPIPE|EAI_AGAIN/i;
const TRANSIENT_STATUS = /\[429\b|\[50\d\b|\[502\b|\[503\b|\[504\b|502|503|504/;
const DEFINITIVE = /PGRST116|\[40[0134]\b|JWT|expired|invalid api key|permission denied|row-level security/i;

function messageOf(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  const parts: string[] = [];
  const err = error as Record<string, unknown>;
  if (typeof err.message === "string") parts.push(err.message);
  if (typeof err.code === "string") parts.push(err.code);
  // Supabase errors nest the fetch cause one or two levels deep.
  const cause = err.cause as unknown;
  if (cause) parts.push(messageOf(cause).slice(0, 500));
  const causeOfCause = (cause as Record<string, unknown> | null)?.cause;
  if (causeOfCause) parts.push(messageOf(causeOfCause).slice(0, 500));
  return parts.join(" | ");
}

export function isTransientSupabaseError(error: unknown): boolean {
  const msg = messageOf(error);
  if (!msg) return false;
  if (DEFINITIVE.test(msg)) return false;
  return TRANSIENT_MESSAGE.test(msg) || TRANSIENT_STATUS.test(msg);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface SupabaseRetryOptions {
  maxAttempts?: number;
  baseMs?: number;
  operation?: string;
}

/**
 * Run `fn` with exponential backoff on transient Supabase network errors.
 * Retries both thrown errors and returned `{ error }` shapes.
 */
export async function withSupabaseRetry<T extends { error?: unknown }>(
  fn: () => Promise<T> | PromiseLike<T>,
  options: SupabaseRetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 4;
  const baseMs = options.baseMs ?? 250;
  const operation = options.operation ?? "supabase query";

  let lastResult: T | null = null;
  let lastThrown: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      if (!result?.error || !isTransientSupabaseError(result.error)) {
        return result;
      }
      lastResult = result;
      if (attempt === maxAttempts) return result;
      const backoffMs = baseMs * 2 ** (attempt - 1) + Math.random() * 200;
      console.warn(
        `[SupabaseRetry] ${operation} attempt ${attempt}/${maxAttempts} transient, retrying in ${Math.round(backoffMs)}ms:`,
        messageOf(result.error).slice(0, 200),
      );
      await sleep(backoffMs);
    } catch (error) {
      lastThrown = error;
      if (attempt === maxAttempts || !isTransientSupabaseError(error)) throw error;
      const backoffMs = baseMs * 2 ** (attempt - 1) + Math.random() * 200;
      console.warn(
        `[SupabaseRetry] ${operation} attempt ${attempt}/${maxAttempts} threw transient, retrying in ${Math.round(backoffMs)}ms:`,
        messageOf(error).slice(0, 200),
      );
      await sleep(backoffMs);
    }
  }

  if (lastThrown) throw lastThrown;
  return lastResult as T;
}
