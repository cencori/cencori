import "server-only";

import type { User } from "@supabase/supabase-js";
import { toSupabaseUser, type BetterAuthUser } from "@/lib/auth/to-supabase-user";

// Tensor desktop sessions on Better Auth (RFC-0001 cutover). The desktop app
// keeps its Supabase-era contract — access_token, refresh_token, expires_in,
// user — so it needs no update: both tokens are one Better Auth session token,
// which the bearer plugin accepts on API calls (getAuthUser(_, token)).
// "Refresh" re-reads the session, which Better Auth extends while it is used.

export interface TensorSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
}

function toTensorSession(token: string, expiresAt: Date | string, user: BetterAuthUser): TensorSession {
  const expiresIn = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  return { access_token: token, refresh_token: token, expires_in: expiresIn, user: toSupabaseUser(user) };
}

export async function createTensorSession(userId: string): Promise<TensorSession | null> {
  const { auth } = await import("@/lib/auth/better-auth");
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.findUserById(userId);
  if (!user) return null;
  const session = await ctx.internalAdapter.createSession(userId);
  return toTensorSession(session.token, session.expiresAt, user as BetterAuthUser);
}

export async function refreshTensorSession(token: string): Promise<TensorSession | null> {
  const { auth } = await import("@/lib/auth/better-auth");
  const result = await auth.api
    .getSession({ headers: new Headers({ authorization: `Bearer ${token}` }) })
    .catch(() => null);
  if (!result?.session || !result.user) return null;
  return toTensorSession(result.session.token, result.session.expiresAt, result.user as BetterAuthUser);
}

export async function revokeTensorSession(token: string): Promise<void> {
  const { auth } = await import("@/lib/auth/better-auth");
  const ctx = await auth.$context;
  await ctx.internalAdapter.deleteSession(token);
}
