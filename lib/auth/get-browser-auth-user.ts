"use client";

import type { SupabaseClient, UserResponse } from "@supabase/supabase-js";
import { isBetterAuthEnabled } from "@/lib/auth/flags";
import { toSupabaseUser, type BetterAuthUser } from "@/lib/auth/to-supabase-user";

// getAuthUser for browser components: same result shape, read from the
// browser Supabase client or, after the cutover, Better Auth's client.
export async function getBrowserAuthUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any, any, any>,
): Promise<UserResponse> {
  if (!isBetterAuthEnabled()) return client.auth.getUser();

  const { authClient } = await import("@/lib/auth/auth-client");
  const { data } = await authClient.getSession();
  if (!data?.user) {
    return { data: { user: null }, error: null } as unknown as UserResponse;
  }
  return { data: { user: toSupabaseUser(data.user as BetterAuthUser) }, error: null };
}
