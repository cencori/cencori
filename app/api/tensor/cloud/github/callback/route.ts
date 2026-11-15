import { type NextRequest, NextResponse } from "next/server";
import { finishTensorGithubSignIn, TENSOR_GITHUB_CALLBACK_URL, tensorGithubState } from "@/lib/tensor-cloud-github-callback";

// Where GitHub returns a person who signed in for Tensor (lib/tensor-cloud-github-callback.ts).
// A browser arrives here, not the Tensor site's server, so nothing is answered in JSON: the
// person is sent back to the page they set out from, with how it went.

export async function GET(request: NextRequest) {
  const state = tensorGithubState(request);
  // Not a return this app sent anyone out for, or one that took too long: there is nowhere
  // known to send them back to but the site's front door.
  if (!state) return NextResponse.redirect("https://tensorade.app/chat?github=failed");
  return finishTensorGithubSignIn(request, state, TENSOR_GITHUB_CALLBACK_URL);
}
