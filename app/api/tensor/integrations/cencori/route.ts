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
  CENCORI_AUTHORIZE_URL,
  CencoriError,
  cencoriToken,
  forgetCencoriAccount,
  listCencoriProjects,
  readCencoriAccountName,
  readCencoriApp,
  TENSOR_CENCORI_CALLBACK_URL,
  TENSOR_CENCORI_SCOPES,
} from "@/lib/tensor-cencori";

// A person's Cencori organization, for Tensor (lib/tensor-cencori.ts).
//
//   GET     whether they have connected Cencori, its projects when they have, and the address to
//           connect at (?site= and ?path= say where to come back to)
//   DELETE  disconnect it (keys already given to projects keep working until they are uninstalled)
//
// The signed state and PKCE are the ones Supabase's connection uses (lib/tensor-cloud.ts).

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

export async function GET(request: NextRequest) {
  try {
    const session = await authenticateTensorBillingRequest(request);
    if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
    const config = readTensorCloudConfig();
    const app = readCencoriApp();
    if (!config || !app) return json({ error: "Cencori is not available here yet." }, 503);

    const site = tensorSiteOrigin(request.nextUrl.searchParams.get("site")) ?? "https://tensorade.app";
    const { state, nonce } = signSupabaseState(
      { userId: session.user.id, site, path: tensorSitePath(request.nextUrl.searchParams.get("path")) },
      config.taskTokenSecret,
    );
    const authorize = new URL(CENCORI_AUTHORIZE_URL);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("client_id", app.clientId);
    authorize.searchParams.set("redirect_uri", TENSOR_CENCORI_CALLBACK_URL);
    authorize.searchParams.set("scope", TENSOR_CENCORI_SCOPES);
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("code_challenge", supabaseCodeChallenge(supabaseCodeVerifier(nonce, config.taskTokenSecret)));
    authorize.searchParams.set("code_challenge_method", "S256");

    const token = await cencoriToken(session.admin, config, app, session.user.id);
    if (!token) return json({ connected: false, expired: token === null, authorizeUrl: authorize.toString() });
    const [projects, organizationName] = await Promise.all([listCencoriProjects(token), readCencoriAccountName(session.admin, session.user.id)]);
    return json({ connected: true, expired: false, authorizeUrl: authorize.toString(), organizationName, projects });
  } catch (error) {
    if (error instanceof CencoriError) return json({ error: error.message }, error.status === 401 ? 409 : error.status);
    console.error("[Tensor Cencori] Reading Cencori failed", error);
    return json({ error: "Tensor could not reach Cencori. Try again shortly." }, 503);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await authenticateTensorBillingRequest(request);
    if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
    const config = readTensorCloudConfig();
    const app = readCencoriApp();
    if (!config || !app) return json({ error: "Cencori is not available here yet." }, 503);
    await forgetCencoriAccount(session.admin, config, app, session.user.id);
    return json({ disconnected: true });
  } catch (error) {
    console.error("[Tensor Cencori] Disconnecting Cencori failed", error);
    return json({ error: "Tensor could not disconnect Cencori." }, 503);
  }
}
