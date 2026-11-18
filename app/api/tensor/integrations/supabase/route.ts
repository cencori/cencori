import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";
import {
  readTensorCloudConfig,
  signSupabaseState,
  supabaseCodeChallenge,
  supabaseCodeVerifier,
  tensorSiteOrigin,
  tensorSitePath,
} from "@/lib/tensor-cloud";
import {
  forgetSupabaseAccount,
  listOrganizations,
  listProjects,
  readSupabaseApp,
  SUPABASE_REGIONS,
  SupabaseError,
  supabaseToken,
  TENSOR_SUPABASE_CALLBACK_URL,
} from "@/lib/tensor-supabase";

// A person's Supabase, for Tensor (lib/tensor-supabase.ts).
//
//   GET     whether they have connected Supabase, their organizations and projects when they
//           have, and the address to connect at (?site= and ?path= say where to come back to)
//   DELETE  disconnect Supabase here (projects already linked keep their variables)

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

export async function GET(request: NextRequest) {
  try {
    const session = await authenticateTensorBillingRequest(request);
    if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
    const config = readTensorCloudConfig();
    const app = readSupabaseApp();
    if (!config || !app) return json({ error: "Supabase is not available yet." }, 503);

    const site = tensorSiteOrigin(request.nextUrl.searchParams.get("site")) ?? "https://tensorade.app";
    const { state, nonce } = signSupabaseState(
      { userId: session.user.id, site, path: tensorSitePath(request.nextUrl.searchParams.get("path")) },
      config.taskTokenSecret,
    );
    const authorize = new URL("https://api.supabase.com/v1/oauth/authorize");
    authorize.searchParams.set("client_id", app.clientId);
    authorize.searchParams.set("redirect_uri", TENSOR_SUPABASE_CALLBACK_URL);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("code_challenge", supabaseCodeChallenge(supabaseCodeVerifier(nonce, config.taskTokenSecret)));
    authorize.searchParams.set("code_challenge_method", "S256");

    const token = await supabaseToken(session.admin, config, app, session.user.id);
    if (!token) {
      return json({ connected: false, expired: token === null, authorizeUrl: authorize.toString(), regions: SUPABASE_REGIONS });
    }
    const [organizations, projects] = await Promise.all([listOrganizations(token), listProjects(token)]);
    return json({ connected: true, expired: false, authorizeUrl: authorize.toString(), organizations, projects, regions: SUPABASE_REGIONS });
  } catch (error) {
    if (error instanceof SupabaseError) return json({ error: error.message }, error.status === 401 ? 409 : error.status);
    console.error("[Tensor Supabase] Reading Supabase failed", error);
    return json({ error: "Tensor could not reach Supabase. Try again shortly." }, 503);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await authenticateTensorBillingRequest(request);
    if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
    await forgetSupabaseAccount(session.admin, session.user.id);
    return json({ disconnected: true });
  } catch (error) {
    console.error("[Tensor Supabase] Disconnecting Supabase failed", error);
    return json({ error: "Tensor could not disconnect Supabase." }, 503);
  }
}
