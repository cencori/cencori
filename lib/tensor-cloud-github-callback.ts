import { type NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerClient } from "@/lib/supabaseServer";
import { type GithubState, readTensorCloudConfig, verifyGithubState } from "@/lib/tensor-cloud";
import { exchangeGithubCode, githubViewer, readGithubApp, saveGithubAccount } from "@/lib/tensor-cloud-github";

/** Where GitHub returns a person who signed in for Tensor. Registered on the GitHub App. */
export const TENSOR_GITHUB_CALLBACK_URL =
  process.env.TENSOR_CLOUD_GITHUB_CALLBACK_URL?.trim() || "https://cencori.com/api/tensor/cloud/github/callback";

/** The state GitHub came back with, when it is one this app signed for a Tensor sign-in. */
export function tensorGithubState(request: NextRequest): GithubState | null {
  const config = readTensorCloudConfig();
  return config ? verifyGithubState(request.nextUrl.searchParams.get("state"), config.taskTokenSecret) : null;
}

/**
 * A person comes back from GitHub, having signed in (and perhaps installed the app) for Tensor.
 *
 * `state` says who set out and where to send them back; that it is signed says it was this app
 * that sent them. It does not say that whoever is returning is that person: a link with someone
 * else's state in it can be handed to anyone. So the browser must also be signed in to Cencori,
 * as the person the state names. Without that check, a stranger's link would tie the GitHub
 * account of whoever followed it to the stranger's account here.
 *
 * `redirectUri` is what was sent to GitHub when the sign-in began, which it wants repeated; null
 * for a sign-in that began as an installation, where none was sent.
 */
export async function finishTensorGithubSignIn(request: NextRequest, state: GithubState, redirectUri: string | null): Promise<NextResponse> {
  const back = (outcome: "connected" | "failed" | "signin" | "cancelled") => {
    const url = new URL(state.path, state.site);
    url.searchParams.set("github", outcome);
    return NextResponse.redirect(url);
  };

  const config = readTensorCloudConfig();
  const app = readGithubApp();
  if (!config || !app) return back("failed");

  // GitHub says so itself when the person declined.
  if (request.nextUrl.searchParams.get("error")) return back("cancelled");
  const code = request.nextUrl.searchParams.get("code");
  if (!code || code.length > 200) return back("failed");

  try {
    const { data } = await getAuthUser(await createServerClient());
    if (!data.user || data.user.id !== state.userId) return back("signin");

    const tokens = await exchangeGithubCode(app, code, redirectUri);
    if (!tokens) return back("failed");
    const viewer = await githubViewer(tokens.accessToken);
    if (!viewer) return back("failed");

    await saveGithubAccount(createAdminClient(), config, state.userId, viewer, tokens);
    return back("connected");
  } catch (error) {
    console.error("[Tensor Cloud] Finishing a GitHub sign-in failed", error);
    return back("failed");
  }
}
