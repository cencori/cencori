"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/auth-client";

/**
 * Goes straight to Google for an app that asked for it (the Tensor phone app's Continue with
 * Google), skipping Cencori's own sign-in choices. Google sends the browser back to this sign-in
 * page, signed in, where the person confirms and returns to the app as from any sign-in.
 */
export function StartProvider({ provider, callbackURL }: { provider: "google"; callbackURL: string }) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void authClient.signIn
      .social({ provider, callbackURL, errorCallbackURL: `/login?redirect=${encodeURIComponent(callbackURL)}` })
      .then(({ error: failed }) => {
        if (failed) setError(failed.message ?? "Google sign-in could not start.");
      })
      .catch(() => setError("Google sign-in could not start."));
  }, [provider, callbackURL]);

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-5 text-foreground">
      <section className="w-full max-w-sm text-center">
        {error ? (
          <>
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
            <a className="mt-4 inline-flex h-10 items-center px-4 text-sm font-medium" href={`/login?redirect=${encodeURIComponent(callbackURL)}`}>
              Sign in another way
            </a>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Opening Google…</p>
        )}
      </section>
    </main>
  );
}
