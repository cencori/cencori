import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerClient } from "@/lib/supabaseServer";
import { pawabaseCodeVerifier, readTensorCloudConfig, verifyPawabaseState } from "@/lib/tensor-cloud";
import { exchangePawabaseCode, readPawabaseApp, savePawabaseAccount } from "@/lib/tensor-pawabase";

/**
 * A person comes back from Pawabase, having connected their organization for Tensor.
 *
 * As with Supabase: the signed state says who set out and where to send them back, and the
 * browser must be signed in to Cencori as that same person, so a link carrying someone else's
 * state cannot tie a stranger's Pawabase to their account. Pawabase's code works once, for ten
 * minutes, and using it twice ends the connection, so it is exchanged once and never retried.
 */
export async function GET(request: NextRequest) {
  const config = readTensorCloudConfig();
  const state = config ? verifyPawabaseState(request.nextUrl.searchParams.get("state"), config.taskTokenSecret) : null;
  if (!config || !state) return NextResponse.redirect("https://tensorade.app/chat");
  const back = (outcome: "connected" | "failed" | "signin" | "cancelled") => {
    const url = new URL(state.path, state.site);
    url.searchParams.set("pawabase", outcome);
    return NextResponse.redirect(url);
  };

  const app = readPawabaseApp();
  if (!app) return back("failed");
  if (request.nextUrl.searchParams.get("error")) return back("cancelled");
  const code = request.nextUrl.searchParams.get("code");
  if (!code || code.length > 500) return back("failed");

  try {
    const { data } = await getAuthUser(await createServerClient());
    if (!data.user || data.user.id !== state.userId) return back("signin");
    const tokens = await exchangePawabaseCode(app, code, pawabaseCodeVerifier(state.nonce, config.taskTokenSecret));
    if (!tokens) return back("failed");
    await savePawabaseAccount(createAdminClient(), config, state.userId, tokens);
    return back("connected");
  } catch (error) {
    console.error("[Tensor Pawabase] Finishing a Pawabase connection failed", error);
    return back("failed");
  }
}
