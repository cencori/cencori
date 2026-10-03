"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Search } from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";
import { VisuallyHidden } from "radix-ui";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSidebar } from "@/components/docs/ui/sidebar";

interface SearchResult {
  title: string;
  description: string;
  section: string;
  href: string;
  snippet: string;
  score: number;
}

function HighlightedSnippet({ text, query }: { text: string; query: string }) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return <>{text}</>;
  const lowerText = text.toLowerCase();
  const lowerQuery = trimmedQuery.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-primary/15 text-foreground rounded-[2px] px-px">
        {text.slice(index, index + trimmedQuery.length)}
      </mark>
      {text.slice(index + trimmedQuery.length)}
    </>
  );
}

export function DocsSearch() {
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/docs/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("search failed");
        const data = await res.json();
        setResults(data.results ?? []);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const hasQuery = query.trim().length >= 2;

  const navigate = React.useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      if (isMobile) setOpenMobile(false);
      router.push(href);
    },
    [isMobile, router, setOpenMobile],
  );

  return (
    <>
      <div className="px-3 pb-2 group-data-[collapsible=icon]:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-muted-foreground hover:text-foreground hover:border-sidebar-border flex w-full items-center gap-2 rounded-md border border-sidebar-border/60 bg-background/60 px-2.5 py-1.5 text-[13px] transition-colors"
        >
          <Search className="size-4 shrink-0 opacity-60" />
          <span className="flex-1 truncate text-left">Search docs...</span>
          <kbd className="bg-sidebar-accent text-muted-foreground rounded border border-sidebar-border/60 px-1.5 py-0.5 text-[10px] font-medium">
            ⌘K
          </kbd>
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-[10vh] translate-y-0 gap-0 overflow-hidden rounded-[28px] border-border/50 bg-background/95 p-0 shadow-lg backdrop-blur-xl sm:max-w-lg"
        >
          <VisuallyHidden.Root>
            <DialogTitle>Search Documentation</DialogTitle>
          </VisuallyHidden.Root>
          <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
            <div className="flex items-center px-5" cmdk-input-wrapper="">
              <Search className="mr-2 size-4 shrink-0 opacity-50" />
              <CommandPrimitive.Input
                placeholder="Search documentation..."
                value={query}
                onValueChange={setQuery}
                className="flex h-12 w-full rounded-md bg-transparent py-3 text-[15px] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            {hasQuery && (
              <CommandList>
                {loading ? (
                  <div className="text-muted-foreground py-6 text-center text-sm">
                    Searching...
                  </div>
                ) : results.length === 0 ? (
                  <CommandEmpty>No results found for “{query.trim()}”.</CommandEmpty>
                ) : (
                  <CommandGroup heading={`${results.length} result${results.length === 1 ? "" : "s"}`}>
                    {results.map((result) => (
                      <CommandItem
                        key={result.href}
                        value={`${result.title} ${result.section} ${result.href}`}
                        onSelect={() => navigate(result.href)}
                        className="flex cursor-pointer items-start gap-3 px-3 py-2.5"
                      >
                        <FileText className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-medium">
                              {result.title}
                            </span>
                            <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                              {result.section}
                            </span>
                          </div>
                          {result.description ? (
                            <p className="text-muted-foreground truncate text-xs">
                              {result.description}
                            </p>
                          ) : null}
                          <p className="text-muted-foreground/80 line-clamp-2 text-xs leading-relaxed">
                            <HighlightedSnippet text={result.snippet} query={query} />
                          </p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            )}
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
