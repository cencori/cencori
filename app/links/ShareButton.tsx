"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = "https://links.cencori.com";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Cencori", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Share sheet dismissed, or clipboard blocked. Nothing to do.
    }
  }

  return (
    <Button type="button" size="sm" className="h-7 text-xs" onClick={share}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden>
        <path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
      </svg>
      {copied ? "Copied" : "Share"}
    </Button>
  );
}
