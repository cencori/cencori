"use client";

import { useDocsContext } from "@/components/docs/DocsContext";
import { usePathname } from "next/navigation";
import { AddMagicIcon } from "@/assets/icons";

export function AskAITrigger() {
  const { setAskAIOpen, setAttachedPage } = useDocsContext();
  const pathname = usePathname();

  const handleClick = () => {
    const title = document.querySelector("h1")?.textContent ?? "This page";
    const slug = pathname.replace(/^\/docs\/?/, "");
    setAttachedPage({ title, slug });
    setAskAIOpen(true);
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
    >
      <AddMagicIcon className="size-3.5 shrink-0" />
      <span>Ask AI</span>
    </button>
  );
}
