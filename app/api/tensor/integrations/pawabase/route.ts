import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";
import {
  pawabaseCodeVerifier,
  readTensorCloudConfig,
  signPawabaseState,
  supabaseCodeChallenge,
  tensorSiteOrigin,
  tensorSitePath,
} from "@/lib/tensor-cloud";
import {
  forgetPawabaseAccount,
  listProjects,
  PAWABASE_ORIGIN,
  PAWABASE_SCOPES,
  PawabaseError,
  pawabaseConnection,
  readPawabaseApp,
  TENSOR_PAWABASE_CALLBACK_URL,
} from "@/lib/tensor-pawabase";

// A person's Pawabase, for Tensor (lib/tensor-pawabase.ts).
//
//   GET     whether they have connected Pawabase, its organization and projects when they have,
//           and the address to connect at (?site= and ?path= say where to come back to)
//   DELETE  disconnect Pawabase (projects already linked keep their variables and keys)

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

export async function GET(request: NextRequest) {
  try {
    const session = await authenticateTensorBillingRequest(request);
    if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
    const config = readTensorCloudConfig();
    const app = readPawabaseApp();
    if (!config || !app) return json({ error: "Pawabase is not available yet." }, 503);

    const site = tensorSiteOrigin(request.nextUrl.searchParams.get("site")) ?? "https://tensorade.app";
    const { state, nonce } = signPawabaseState(
      { userId: session.user.id, site, path: tensorSitePath(request.nextUrl.searchParams.get("path")) },
      config.taskTokenSecret,
    );
    const authorize = new URL(`${PAWABASE_ORIGIN}/oauth/authorize`);
    authorize.searchParams.set("client_id", app.clientId);
    authorize.searchParams.set("redirect_uri", TENSOR_PAWABASE_CALLBACK_URL);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("scope", PAWABASE_SCOPES);
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("code_challenge", supabaseCodeChallenge(pawabaseCodeVerifier(nonce, config.taskTokenSecret)));
    authorize.searchParams.set("code_challenge_method", "S256");

    const connection = await pawabaseConnection(session.admin, config, app, session.user.id);
    if (!connection) {
      return json({ connected: false, expired: connection === null, authorizeUrl: authorize.toString() });
    }
    const projects = await listProjects(connection.token);
    return json({
      connected: true,
      expired: false,
      authorizeUrl: authorize.toString(),
      organization: connection.organization,
      projects: projects.map((project) => ({ id: project.id, ref: project.ref, name: project.name, state: project.state })),
    });
  } catch (error) {
    if (error instanceof PawabaseError) return json({ error: error.message }, error.status === 401 ? 409 : error.status);
    console.error("[Tensor Pawabase] Reading Pawabase failed", error);
    return json({ error: "Tensor could not reach Pawabase. Try again shortly." }, 503);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await authenticateTensorBillingRequest(request);
    if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
    const config = readTensorCloudConfig();
    if (!config) return json({ error: "Pawabase is not available yet." }, 503);
    await forgetPawabaseAccount(session.admin, config, readPawabaseApp(), session.user.id);
    return json({ disconnected: true });
  } catch (error) {
    console.error("[Tensor Pawabase] Disconnecting Pawabase failed", error);
    return json({ error: "Tensor could not disconnect Pawabase." }, 503);
  }
}
