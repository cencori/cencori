import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerClient } from "@/lib/supabaseServer";
import { readTensorCloudConfig, supabaseCodeVerifier, verifySupabaseState } from "@/lib/tensor-cloud";
import { exchangeSupabaseCode, readSupabaseApp, saveSupabaseAccount } from "@/lib/tensor-supabase";

/**
 * A person comes back from Supabase, having connected their account for Tensor.
 *
 * As with GitHub (lib/tensor-cloud-github-callback.ts): the signed state says who set out and
 * where to send them back, and the browser must be signed in to Cencori as that same person, so a
 * link carrying someone else's state cannot tie a stranger's Supabase to their account.
 */
export async function GET(request: NextRequest) {
  const config = readTensorCloudConfig();
  const state = config ? verifySupabaseState(request.nextUrl.searchParams.get("state"), config.taskTokenSecret) : null;
  if (!config || !state) return NextResponse.redirect("https://tensorade.app/chat");
  const back = (outcome: "connected" | "failed" | "signin" | "cancelled") => {
    const url = new URL(state.path, state.site);
    url.searchParams.set("supabase", outcome);
    return NextResponse.redirect(url);
  };

  const app = readSupabaseApp();
  if (!app) return back("failed");
  if (request.nextUrl.searchParams.get("error")) return back("cancelled");
  const code = request.nextUrl.searchParams.get("code");
  if (!code || code.length > 500) return back("failed");

  try {
    const { data } = await getAuthUser(await createServerClient());
    if (!data.user || data.user.id !== state.userId) return back("signin");
    const tokens = await exchangeSupabaseCode(app, code, supabaseCodeVerifier(state.nonce, config.taskTokenSecret));
    if (!tokens) return back("failed");
    await saveSupabaseAccount(createAdminClient(), config, state.userId, tokens);
    return back("connected");
  } catch (error) {
    console.error("[Tensor Supabase] Finishing a Supabase connection failed", error);
    return back("failed");
  }
}
