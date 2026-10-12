"use client";

import { useEffect, useState } from "react";
import { gateReply, quickGateEmail } from "@/lib/tensor-email-quick";

const DONE_KEY = "tensor-waitlist-email-v1";
const LEGACY_KEY = "tensor-waitlist-progress-v1";

function loadDoneEmail(): string | null {
  if (typeof window === "undefined") return null;
  try {
    // Drop any half-finished conversational progress from the old chat.
    window.localStorage.removeItem(LEGACY_KEY);
    const raw = window.localStorage.getItem(DONE_KEY);
    return raw && raw.includes("@") ? raw : null;
  } catch {
    return null;
  }
}

export function TensorWaitlistChat({ onClose }: { onClose: () => void }) {
  const [restored] = useState<string | null>(() => loadDoneEmail());
  const [email, setEmail] = useState(() => restored ?? "");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "submitting" | "done">(() =>
    restored ? "done" : "idle",
  );
  const [finalIn, setFinalIn] = useState(() => restored !== null);

  useEffect(() => {
    if (!restored) return;
    const t = window.setTimeout(() => setFinalIn(true), 50);
    return () => window.clearTimeout(t);
  }, [restored]);

  useEffect(() => {
    if (state !== "done") return;
    const t = window.setTimeout(() => setFinalIn(true), 50);
    return () => window.clearTimeout(t);
  }, [state]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (state === "submitting" || state === "done") return;
    const value = email.trim();
    const quick = quickGateEmail(value);
    if (quick !== "ok") {
      setError(gateReply(quick));
      return;
    }
    setState("submitting");
    setError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: value,
          workEmail: value,
          productName: "tensor",
          source: "tensor-email",
        }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error || `save failed (${res.status})`);
      try {
        window.localStorage.setItem(DONE_KEY, value);
      } catch {
        // Storage blocked — success still stands for this session.
      }
      setFinalIn(false);
      setState("done");
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : "Couldn't save that — try again.");
    }
  }

  function reset() {
    try {
      window.localStorage.removeItem(DONE_KEY);
    } catch {
      // ignore — reset still works in memory.
    }
    setEmail("");
    setError(null);
    setState("idle");
    setFinalIn(false);
  }

  if (state === "done") {
    return (
      <section
        id="waitlist"
        aria-label="Tensor waitlist confirmed"
        className="mx-auto grid h-full min-h-0 w-full max-w-2xl flex-1 place-items-center overflow-hidden px-5 pb-4 pt-2 md:px-8"
      >
        <div
          className={`flex w-full flex-col items-center text-center transition-all duration-500 ease-out ${
            finalIn ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[0.98] opacity-0"
          }`}
        >
          <p className="text-base font-semibold text-white md:text-lg">You&apos;re on the Tensor waitlist.</p>
          {email ? (
            <p className="mt-2 text-sm text-white/50">
              We&apos;ll reach out at {email} as soon as your seat opens.
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white px-4 py-2 text-xs font-medium text-black transition-colors hover:bg-white/85"
            >
              Back to overview
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-white/15 px-4 py-2 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              Add another email
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="waitlist"
      aria-label="Tensor waitlist"
      className="mx-auto flex h-full min-h-0 w-full max-w-2xl flex-1 flex-col overflow-hidden px-5 pb-4 pt-2 touch-manipulation md:px-8"
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className="px-0 py-1 text-sm text-white/40 transition-colors hover:text-white"
        >
          ← Back
        </button>
      </div>

      <div className="grid min-h-0 flex-1 place-items-center">
        <div className="w-full max-w-md text-center">
          <p className="text-base font-semibold text-white md:text-lg">Get early access to Tensor.</p>
          <p className="mt-2 text-sm leading-relaxed text-white/50">
            Drop your email and we&apos;ll reach out as soon as your seat opens.
          </p>
          <form onSubmit={submit} className="mx-auto mt-6 w-full">
            <div className="flex min-h-[3.25rem] w-full items-center gap-2 rounded-full border border-white/10 bg-[#1c1c1e] py-1.5 pl-5 pr-1.5 shadow-[0_1.5rem_4rem_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.025)]">
              <input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="name@company.com"
                aria-label="Email address"
                type="email"
                autoComplete="email"
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-[16px] font-normal leading-[1.55] tracking-[-0.012em] text-white placeholder:text-white/30 focus:outline-none sm:text-[0.85rem]"
              />
              <button
                type="submit"
                aria-label="Join waitlist"
                disabled={state === "submitting" || !email.trim()}
                className="grid h-[2.25rem] w-[2.25rem] shrink-0 place-items-center rounded-full bg-[#f0f0f2] text-[#1c1c1e] transition-transform hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
              >
                {state === "submitting" ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border border-black/20 border-t-black/80" aria-hidden="true" />
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" width="14" height="14" stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 11 7-7 7 7M12 4v16" />
                  </svg>
                )}
              </button>
            </div>
            {error ? (
              <p role="alert" className="mt-3 text-[13px] leading-relaxed text-white/70">
                {error}
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </section>
  );
}
