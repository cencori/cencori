"use server";

import { redirect } from "next/navigation";
import {
  TENSOR_CALLBACK_URL,
  tensorSignInPath,
  isTensorChallenge,
  isTensorRedirectUri,
  isTensorState,
} from "@/lib/tensor-auth";
import { createServerClient } from "@/lib/supabaseServer";

export async function useAnotherCencoriAccount(formData: FormData): Promise<never> {
  const challenge = String(formData.get("code_challenge") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? TENSOR_CALLBACK_URL);
  const state = String(formData.get("state") ?? "");
  if (
    !isTensorChallenge(challenge) ||
    !isTensorState(state) ||
    !isTensorRedirectUri(redirectUri)
  ) {
    redirect("/login");
  }

  const supabase = await createServerClient();
  await supabase.auth.signOut({ scope: "local" });
  const returnTo = tensorSignInPath(challenge, state, redirectUri);
  redirect(`/login?redirect=${encodeURIComponent(returnTo)}`);
}
