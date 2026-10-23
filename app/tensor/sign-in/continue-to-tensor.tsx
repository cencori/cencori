"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ContinueToTensorProps = {
  challenge: string;
  redirectUri: string;
  state: string;
};

type AuthorizeResponse = {
  callback_url?: string;
  error?: string;
  login_url?: string;
};

/**
 * How long a prepared link is trusted. The handoff code lives five minutes on the server; this
 * leaves a minute of margin so a click never carries a code that expires on the way to the app.
 */
const PREPARED_LINK_MAX_AGE_MS = 4 * 60 * 1000;

type PreparedLink = { preparedAt: number; url: string };

/**
 * Opens Tensor with one click.
 *
 * Browsers only let a page open an app from a click while that click is still being handled. The
 * button used to ask the server for the handoff link first and open the app after the answer
 * came back, by which point Safari no longer counted it as the click — so the first press often
 * did nothing and people pressed again, or gave up. The link is now prepared as the page loads,
 * and the click opens it at once. A link that has gone stale while the page sat open is fetched
 * on the click instead, which is the old behaviour and still works in most browsers.
 */
export function ContinueToTensor({ challenge, redirectUri, state }: ContinueToTensorProps) {
  const prepared = useRef<PreparedLink | null>(null);
  const preparing = useRef<Promise<PreparedLink | null> | null>(null);
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const prepare = useCallback((): Promise<PreparedLink | null> => {
    preparing.current ??= (async () => {
      try {
        const response = await fetch("/api/tensor/auth/authorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code_challenge: challenge, redirect_uri: redirectUri, state }),
        });
        const result = (await response.json()) as AuthorizeResponse;
        if (response.status === 401 && result.login_url) {
          window.location.assign(result.login_url);
          return null;
        }
        if (!response.ok || !result.callback_url) {
          throw new Error(result.error || "Cencori could not open Tensor.");
        }
        prepared.current = { preparedAt: Date.now(), url: result.callback_url };
        return prepared.current;
      } finally {
        preparing.current = null;
      }
    })();
    return preparing.current;
  }, [challenge, redirectUri, state]);

  const isFresh = (link: PreparedLink | null): link is PreparedLink =>
    link !== null && Date.now() - link.preparedAt < PREPARED_LINK_MAX_AGE_MS;

  // Ready before the click, and again on coming back to a tab that sat open long enough to go
  // stale. A failure here is not shown: the click tries again and reports its own.
  useEffect(() => {
    const ensureFresh = (): void => {
      if (!isFresh(prepared.current)) void prepare().catch(() => {});
    };
    ensureFresh();
    window.addEventListener("focus", ensureFresh);
    return () => window.removeEventListener("focus", ensureFresh);
  }, [prepare]);

  async function continueToTensor() {
    setError(null);
    const ready = prepared.current;
    if (isFresh(ready)) {
      // Still inside the click: this is what lets the browser open the app.
      window.location.assign(ready.url);
      setOpened(true);
      return;
    }

    setLoading(true);
    try {
      const link = await prepare();
      if (!link) return;
      window.location.assign(link.url);
      setOpened(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Cencori could not open Tensor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        className="h-12 w-full rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-65"
        disabled={loading}
        onClick={continueToTensor}
        type="button"
      >
        {loading ? "Getting Tensor ready…" : opened ? "Open Tensor" : "Continue to Tensor"}
      </button>

      {opened ? (
        <p className="mt-4 text-xs leading-5 text-muted-foreground" role="status">
          Tensor didn&apos;t open? Click <span className="text-foreground">Open Tensor</span>{" "}
          again.
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
