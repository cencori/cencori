import type { SupabaseClient, UserResponse } from "@supabase/supabase-js";

// The one place the app asks "who is signed in?". Today it is Supabase Auth;
// RFC-0001 moves auth to Better Auth, and only this file changes at that
// cutover. The return shape matches `supabase.auth.getUser()` so call sites
// switch over without changing behaviour.
//
// Works with both the server client (lib/supabaseServer) and the browser
// client (lib/supabaseClient): it only uses the client it is given.
export async function getAuthUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any, any, any>,
  token?: string,
): Promise<UserResponse> {
  return token ? client.auth.getUser(token) : client.auth.getUser();
}
