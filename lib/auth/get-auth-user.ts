import "server-only";

import type { SupabaseClient, UserResponse } from "@supabase/supabase-js";
import { isBetterAuthEnabled } from "@/lib/auth/flags";
import { toSupabaseUser, type BetterAuthUser } from "@/lib/auth/to-supabase-user";

// The one place server code asks "who is signed in?". Supabase Auth until the
// RFC-0001 cutover, Better Auth after it (isBetterAuthEnabled). The return
// shape matches `supabase.auth.getUser()` either way, so call sites don't
// change. Browser components use getBrowserAuthUser instead.
//
// `token` is a bearer token from a non-browser client (the Tensor desktop
// app); without it the session comes from the request's cookies.
export async function getAuthUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any, any, any>,
  token?: string,
): Promise<UserResponse> {
  if (!isBetterAuthEnabled()) {
    return token ? client.auth.getUser(token) : client.auth.getUser();
  }

  const [{ auth }, { headers }] = await Promise.all([
    import("@/lib/auth/better-auth"),
    import("next/headers"),
  ]);
  const requestHeaders = token
    ? new Headers({ authorization: `Bearer ${token}` })
    : await headers();
  const session = await auth.api.getSession({ headers: requestHeaders }).catch(() => null);
  if (!session?.user) {
    return { data: { user: null }, error: null } as unknown as UserResponse;
  }
  return { data: { user: toSupabaseUser(session.user as BetterAuthUser) }, error: null };
}
