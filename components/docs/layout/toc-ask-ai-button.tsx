"use client";

import { useDocsContext } from "@/components/docs/DocsContext";
import { AddMagicIcon } from "@/assets/icons";

export function TocAskAIButton({
  pageTitle,
  pageSlug,
}: {
  pageTitle: string;
  pageSlug: string;
}) {
  const { setAskAIOpen, setAttachedPage, setScope } = useDocsContext();

  const handleClick = () => {
    setScope("page");
    setAttachedPage({ title: pageTitle, slug: pageSlug });
    setAskAIOpen(true);
  };

  return (
    <button
      onClick={handleClick}
      className="mt-6 flex w-full items-center gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-border/80 hover:bg-muted/40 hover:text-foreground"
    >
      <AddMagicIcon className="size-3.5 shrink-0 text-primary/70" />
      <span>Ask about this page</span>
    </button>
  );
}
