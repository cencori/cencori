"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Mac = "apple-silicon" | "intel";

const UNQUARANTINE = "xattr -dr com.apple.quarantine /Applications/Tensor.app";

const LABELS: Record<Mac, string> = {
  "apple-silicon": "Apple Silicon",
  intel: "Intel",
};

/**
 * Which Mac this is, as far as the browser will say. Chromium answers directly; Safari and
 * Firefox only through the GPU's name. Nearly every Mac sold since 2020 is Apple Silicon, so
 * that is the answer when neither is sure.
 */
async function detectMac(): Promise<Mac> {
  const data = (
    navigator as Navigator & {
      userAgentData?: {
        getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }>;
      };
    }
  ).userAgentData;
  try {
    const { architecture } = (await data?.getHighEntropyValues?.(["architecture"])) ?? {};
    if (architecture === "arm") return "apple-silicon";
    if (architecture === "x86") return "intel";
  } catch {
    // Not offered: fall through to the GPU.
  }
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    const renderer = gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    if (/Intel|AMD|Radeon/i.test(renderer)) return "intel";
  } catch {
    // No WebGL: keep the default.
  }
  return "apple-silicon";
}

function CopyCommand() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-1.5 pl-4 pr-1.5">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[0.82rem] text-white/85">
        {UNQUARANTINE}
      </code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(UNQUARANTINE);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
          } catch {
            setCopied(false);
          }
        }}
        className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/15"
        aria-label="Copy the command"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/**
 * The download page for early testers: the right build for their Mac in one click, then the three
 * steps that get an app without an Apple Developer ID past Gatekeeper on its first launch.
 */
export function TensorDownload() {
  const [mac, setMac] = useState<Mac>("apple-silicon");
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(/Mac/i.test(navigator.userAgent) && !/iPhone|iPad/i.test(navigator.userAgent));
    void detectMac().then(setMac);
  }, []);

  const other: Mac = mac === "apple-silicon" ? "intel" : "apple-silicon";

  return (
    <div className="marketing-theme dark relative isolate min-h-screen bg-black text-white [color-scheme:dark]">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 pb-10 pt-20 md:px-8 md:pt-28">
        <Link
          href="/tensor"
          className="font-inter mb-10 flex w-fit items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-white"
        >
          <img src="/tensor/base.png" alt="" aria-hidden="true" className="h-3 w-auto" />
          Tensor
        </Link>

        <h1 className="font-inter text-balance text-3xl font-normal leading-[1.15] tracking-tight sm:text-4xl">
          Download Tensor
        </h1>
        <p className="font-inter mt-4 max-w-xl text-[0.98rem] leading-relaxed text-white/60">
          Early access for macOS. Thanks for testing it with us.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
          <a
            href={`/tensor/download/${mac}`}
            className="font-inter inline-flex min-h-[2.6rem] items-center gap-2.5 rounded-full bg-[#f3f3ef] px-5 text-[0.95rem] font-medium tracking-[-0.005em] text-[#050505] transition-colors hover:bg-[#e4e4de]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.75 2.27-1.6 2.78-.41 6.88 1.15 9.13.76 1.1 1.67 2.33 2.86 2.29 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.22.87-1.27 1.23-2.5 1.25-2.57-.03-.01-2.4-.92-2.42-3.66zM14.1 5.86c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.6-2.66 1.37-.58.67-1.09 1.75-.96 2.79 1.02.08 2.05-.52 2.68-1.27z" />
            </svg>
            Download for Mac
          </a>
          <span className="font-inter text-sm text-white/45">
            {LABELS[mac]} ·{" "}
            <a href={`/tensor/download/${other}`} className="text-white/70 underline underline-offset-4 hover:text-white">
              {LABELS[other]} instead
            </a>
          </span>
        </div>
        {isMac ? null : (
          <p className="font-inter mt-4 text-sm text-white/45">
            Tensor runs on macOS for now. Open this page on your Mac to download it.
          </p>
        )}

        <section aria-labelledby="install-title" className="mt-16">
          <h2 id="install-title" className="font-inter text-lg font-medium tracking-tight">
            Install
          </h2>
          <ol className="font-inter mt-6 space-y-8 text-[0.95rem] leading-relaxed text-white/70">
            <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
              <span className="text-white/35">1</span>
              <div>
                <p className="text-white">Move Tensor to Applications</p>
                <p className="mt-1">Open the file you downloaded and drag Tensor into the Applications folder.</p>
              </div>
            </li>
            <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
              <span className="text-white/35">2</span>
              <div className="min-w-0">
                <p className="text-white">Let macOS open it</p>
                <p className="mt-1">
                  This early build isn’t signed with an Apple Developer ID yet, so macOS will refuse to
                  open it, or say it’s damaged. It isn’t. Open Terminal, paste this, and press Return:
                </p>
                <CopyCommand />
                <p className="mt-3 text-sm text-white/45">
                  Prefer not to use Terminal? Try opening Tensor once, then go to System Settings →
                  Privacy &amp; Security and choose <span className="text-white/70">Open Anyway</span>.
                </p>
              </div>
            </li>
            <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
              <span className="text-white/35">3</span>
              <div>
                <p className="text-white">Open Tensor and sign in</p>
                <p className="mt-1">
                  Sign in with your Cencori account, choose a project folder, and start a task.{" "}
                  <Link href="/tensor/docs" className="text-white underline underline-offset-4">
                    Read the docs
                  </Link>
                  .
                </p>
              </div>
            </li>
          </ol>
        </section>

        <p className="font-inter mt-auto pt-16 text-xs text-white/40">© 2026 Cencori, Inc.</p>
      </main>
    </div>
  );
}
