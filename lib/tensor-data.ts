import { createHash } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { getCachedTensorUser, setCachedTensorUser } from "@/lib/config-cache";
import { createAdminClient } from "@/lib/supabaseAdmin";

export type TensorDataSession = {
  admin: ReturnType<typeof createAdminClient>;
  user: User;
};

export async function authenticateTensorDataRequest(
  authorization: string | null,
): Promise<TensorDataSession | null> {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  if (!token || token.length > 4096) return null;

  const admin = createAdminClient();
  // Verified once with Supabase, then reused briefly: this runs before every model call of every
  // turn, and the round trip was most of a call's pre-dispatch time.
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const cached = await getCachedTensorUser<User>(tokenHash);
  if (cached?.id) return { admin, user: cached };
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  void setCachedTensorUser(tokenHash, data.user, tokenExpiry(token));
  return { admin, user: data.user };
}

/** The token's `exp`, read without verifying it: it only bounds how long a verified answer lasts. */
function tokenExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp?: unknown;
    };
    return typeof claims.exp === "number" ? claims.exp : null;
  } catch {
    return null;
  }
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

export function cleanText(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned && cleaned.length <= maximum ? cleaned : null;
}

/**
 * A Tensor task becomes durable only after its first turn exists. Filtering zero-turn shells
 * keeps interrupted task creation (renderer reloads, failed turn starts) out of account history.
 */
export function threadsWithPersistedTurns<T extends { id?: unknown }>(
  threads: T[],
  persistedThreadIds: ReadonlySet<string>,
): T[] {
  return threads.filter(
    (thread) => typeof thread.id === "string" && persistedThreadIds.has(thread.id),
  );
}

/** The six counts a token figure has to carry. A partial one is a total with holes in it. */
const TOKEN_FIELDS = [
  "totalTokens",
  "inputTokens",
  "cachedInputTokens",
  "cacheWriteInputTokens",
  "outputTokens",
  "reasoningOutputTokens",
] as const;

export type TensorThreadUsageEntry = {
  threadId: string;
  tokens: Record<(typeof TOKEN_FIELDS)[number], number>;
  updatedAt: number;
};

/**
 * Reads the thread-spend payload the desktop sends, from a turn lease or from a transcript import.
 *
 * Entries that do not survive are dropped rather than failing the batch: a device filing months of
 * imported history must not lose the lot because one transcript was odd.
 */
export function readThreadUsageEntries(value: unknown): TensorThreadUsageEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: TensorThreadUsageEntry[] = [];
  for (const raw of value.slice(0, 500)) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as Record<string, unknown>;
    const threadId = typeof candidate.threadId === "string" ? candidate.threadId.slice(0, 200) : "";
    if (!threadId) continue;
    const source = candidate.tokens;
    if (!source || typeof source !== "object") continue;
    const tokens = {} as TensorThreadUsageEntry["tokens"];
    let complete = true;
    for (const field of TOKEN_FIELDS) {
      const count = (source as Record<string, unknown>)[field];
      if (typeof count !== "number" || !Number.isFinite(count) || count < 0) {
        complete = false;
        break;
      }
      tokens[field] = Math.round(count);
    }
    if (!complete) continue;
    const updatedAt =
      typeof candidate.updatedAt === "number" && Number.isFinite(candidate.updatedAt)
        ? Math.round(candidate.updatedAt)
        : Date.now();
    entries.push({ threadId, tokens, updatedAt });
  }
  return entries;
}
