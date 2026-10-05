"use client";

import { useCallback, useEffect, useState } from "react";
import { TensorMock } from "./TensorMock";
import { TensorWaitlistChat } from "./TensorWaitlistChat";

export function TensorPageShell() {
  const [mode, setMode] = useState<"landing" | "chat">("landing");
  const [leaving, setLeaving] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);

  // Deep-link: /tensor#waitlist opens straight into the agent.
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#waitlist") {
      setMode("chat");
      setChatVisible(true);
    }
  }, []);

  const openChat = useCallback(() => {
    if (mode === "chat") return;
    setLeaving(true);
    window.setTimeout(() => {
      setMode("chat");
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", "/tensor#waitlist");
      }
      requestAnimationFrame(() => requestAnimationFrame(() => setChatVisible(true)));
      requestAnimationFrame(() =>
        document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }, 450);
  }, [mode]);

  const closeChat = useCallback(() => {
    setChatVisible(false);
    window.setTimeout(() => {
      setMode("landing");
      setLeaving(false);
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", "/tensor");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 350);
  }, []);

  return (
    <div className="marketing-theme dark relative isolate min-h-screen bg-black text-white [color-scheme:dark]">
      <main className={`relative flex flex-col ${mode === "chat" ? "h-[100svh] overflow-hidden" : "min-h-screen"}`}>
        {mode === "landing" ? (
          <div
            className={`flex flex-1 flex-col justify-center pt-16 transition-all duration-500 ease-out ${
              leaving ? "pointer-events-none -translate-y-4 opacity-0" : "translate-y-0 opacity-100"
            }`}
          >
            <section className="mx-auto w-full max-w-5xl px-5 pb-10 text-left md:px-8">
              <p className="font-inter mb-5 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-white">
                <img src="/tensor/base.png" alt="" aria-hidden="true" className="h-3 w-auto" />
                Tensor
              </p>
              <h1 className="font-inter max-w-3xl text-balance text-3xl font-normal leading-[1.15] tracking-tight text-white sm:text-4xl">
                The Agentic Development Environment for the Ambitious
              </h1>
              <a
                href="#waitlist"
                onClick={(e) => {
                  e.preventDefault();
                  openChat();
                }}
                className="font-inter mt-7 inline-flex min-h-[2.2rem] items-center rounded-full bg-[#f3f3ef] px-4 text-[0.92rem] font-medium tracking-[-0.005em] text-[#050505] transition-colors hover:bg-[#e4e4de]"
              >
                Join waitlist
              </a>
            </section>
            <section className="mx-auto hidden w-full max-w-5xl px-5 md:block md:px-8">
              <TensorMock />
            </section>
          </div>
        ) : (
          <div
            className={`flex min-h-0 flex-1 flex-col pt-6 transition-all duration-500 ease-out ${
              chatVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
            }`}
          >
            <TensorWaitlistChat onClose={closeChat} />
          </div>
        )}
        <div className="mx-auto flex w-full max-w-5xl shrink-0 items-center justify-between px-5 pb-8 pt-4 md:px-8">
          <div className="flex items-center gap-5">
            <a
              href="https://x.com/tensorade"
              target="_blank"
              rel="noreferrer"
              aria-label="Tensor on X"
              className="text-white/50 transition-colors hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="https://linkedin.com/company/cencori"
              target="_blank"
              rel="noreferrer"
              aria-label="Cencori on LinkedIn"
              className="text-white/50 transition-colors hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
          </div>
          <span className="text-xs text-white/40">© 2026 Cencori, Inc.</span>
        </div>
      </main>
    </div>
  );
}
