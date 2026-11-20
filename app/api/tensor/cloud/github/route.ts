import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/tensor-auth";
import { authenticateTensorBillingRequest } from "@/lib/tensor-billing";
import { readTensorCloudConfig, signGithubState, tensorSiteOrigin, tensorSitePath } from "@/lib/tensor-cloud";
import { forgetGithubAccount, listInstalledOwners,
  listPushableRepositories, readGithubAccount, readGithubApp } from "@/lib/tensor-cloud-github";
import { TENSOR_GITHUB_CALLBACK_URL } from "@/lib/tensor-cloud-github-callback";

// A person's GitHub, for Tensor in the cloud.
//
//   GET     whether they have signed in with GitHub, the repositories they can push to, and the
//           addresses to sign in at and to choose repositories at (?site= and ?path= say where
//           on the Tensor site to come back to)
//   DELETE  sign out of GitHub here, and disconnect every project of theirs

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

export async function GET(request: NextRequest) {
  try {
    const session = await authenticateTensorBillingRequest(request);
    if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
    const config = readTensorCloudConfig();
    const app = readGithubApp();
    if (!config || !app) return json({ error: "GitHub is not available yet." }, 503);

    const site = tensorSiteOrigin(request.nextUrl.searchParams.get("site")) ?? "https://tensorade.app";
    const state = signGithubState(
      { userId: session.user.id, site, path: tensorSitePath(request.nextUrl.searchParams.get("path")) },
      config.taskTokenSecret,
    );
    const authorize = new URL("https://github.com/login/oauth/authorize");
    authorize.searchParams.set("client_id", app.clientId);
    authorize.searchParams.set("redirect_uri", TENSOR_GITHUB_CALLBACK_URL);
    authorize.searchParams.set("state", state);
    // Where the app is put on an account, or its choice of repositories is changed.
    const install = new URL(`https://github.com/apps/${app.slug}/installations/new`);
    install.searchParams.set("state", state);

    const account = await readGithubAccount(session.admin, config, app, session.user.id);
    const [repositories, owners] = account?.token
      ? await Promise.all([listPushableRepositories(account.token), listInstalledOwners(account.token)])
      : [null, null];
    return json({
      account: account ? { login: account.login, expired: !account.token } : null,
      repositories,
      // Where a new repository can go: the accounts the app is installed on.
      owners,
      authorizeUrl: authorize.toString(),
      installUrl: install.toString(),
    });
  } catch (error) {
    console.error("[Tensor Cloud] Reading GitHub failed", error);
    return json({ error: "Tensor could not reach GitHub. Try again shortly." }, 503);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await authenticateTensorBillingRequest(request);
    if (!session) return json({ error: "Your Cencori session is invalid." }, 401);
    await forgetGithubAccount(session.admin, session.user.id);
    return json({ signedOut: true });
  } catch (error) {
    console.error("[Tensor Cloud] Signing out of GitHub failed", error);
    return json({ error: "Tensor could not sign you out of GitHub. Try again shortly." }, 503);
  }
}
