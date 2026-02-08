"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FileText, Search, ArrowRight, Hash, Loader2 } from "lucide-react";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";

interface SearchResult {
    title: string;
    description: string;
    section: string;
    href: string;
    snippet: string;
    score: number;
}

interface QuickLink {
    title: string;
    href: string;
    icon: React.ReactNode;
}

const quickLinks: QuickLink[] = [
    { title: "Introduction", href: "/docs/introduction", icon: <FileText className="h-4 w-4" /> },
    { title: "Quick Start", href: "/docs/quick-start", icon: <ArrowRight className="h-4 w-4" /> },
    { title: "AI Gateway", href: "/docs/ai/gateway", icon: <Hash className="h-4 w-4" /> },
    { title: "SDK Reference", href: "/docs/ai/sdk", icon: <FileText className="h-4 w-4" /> },
    { title: "Authentication", href: "/docs/api/authentication", icon: <Hash className="h-4 w-4" /> },
    { title: "Security", href: "/docs/security/pii-detection", icon: <FileText className="h-4 w-4" /> },
];

interface DocsSearchModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DocsSearchModal({ open, onOpenChange }: DocsSearchModalProps) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);

    // Debounced search
    useEffect(() => {
        if (!query || query.length < 2) {
            setResults([]);
            return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/docs/search?q=${encodeURIComponent(query)}`, {
                    signal: controller.signal,
                });
                const data = await res.json();
                setResults(data.results || []);
            } catch (error) {
                if ((error as Error).name !== "AbortError") {
                    console.error("Search error:", error);
                }
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [query]);

    const handleSelect = useCallback((href: string) => {
        onOpenChange(false);
        setQuery("");
        setResults([]);
        router.push(href);
    }, [onOpenChange, router]);

    // Group results by section
    const groupedResults = results.reduce((acc, result) => {
        const section = result.section || "Documentation";
        if (!acc[section]) {
            acc[section] = [];
        }
        acc[section].push(result);
        return acc;
    }, {} as Record<string, SearchResult[]>);

    return (
        <CommandDialog open={open} onOpenChange={onOpenChange}>
            <CommandInput
                placeholder="Search documentation..."
                value={query}
                onValueChange={setQuery}
            />
            <CommandList>
                {loading && (
                    <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                )}

                {!loading && query.length < 2 && (
                    <>
                        <CommandGroup heading="Quick Links">
                            {quickLinks.map((link) => (
                                <CommandItem
                                    key={link.href}
                                    value={link.title}
                                    onSelect={() => handleSelect(link.href)}
                                    className="flex items-center gap-3 cursor-pointer"
                                >
                                    <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border/40 bg-muted/50">
                                        {link.icon}
                                    </span>
                                    <span className="text-sm">{link.title}</span>
                                    <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <div className="p-2 border-t border-border/40">
                            <p className="text-xs text-muted-foreground text-center">
                                Type to search across all documentation
                            </p>
                        </div>
                    </>
                )}

                {!loading && query.length >= 2 && results.length === 0 && (
                    <CommandEmpty>
                        <div className="flex flex-col items-center gap-2 py-6">
                            <Search className="h-10 w-10 text-muted-foreground/50" />
                            <p className="text-sm text-muted-foreground">No results found for &quot;{query}&quot;</p>
                            <p className="text-xs text-muted-foreground/70">Try searching with different keywords</p>
                        </div>
                    </CommandEmpty>
                )}

                {!loading && Object.keys(groupedResults).map((section) => (
                    <CommandGroup key={section} heading={section}>
                        {groupedResults[section].map((result) => (
                            <CommandItem
                                key={result.href}
                                value={`${result.title} ${result.description}`}
                                onSelect={() => handleSelect(result.href)}
                                className="flex flex-col items-start gap-1 cursor-pointer py-3"
                            >
                                <div className="flex items-center gap-2 w-full">
                                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <span className="font-medium text-sm">{result.title}</span>
                                    <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground/50" />
                                </div>
                                {result.snippet && (
                                    <p className="text-xs text-muted-foreground line-clamp-2 pl-6">
                                        {result.snippet}
                                    </p>
                                )}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                ))}
            </CommandList>
            <div className="flex items-center justify-between border-t border-border/40 px-3 py-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                        <kbd className="rounded border border-border/50 bg-muted px-1.5 py-0.5 font-mono text-[10px]">↑</kbd>
                        <kbd className="rounded border border-border/50 bg-muted px-1.5 py-0.5 font-mono text-[10px]">↓</kbd>
                        <span className="ml-1">Navigate</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <kbd className="rounded border border-border/50 bg-muted px-1.5 py-0.5 font-mono text-[10px]">↵</kbd>
                        <span className="ml-1">Select</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <kbd className="rounded border border-border/50 bg-muted px-1.5 py-0.5 font-mono text-[10px]">esc</kbd>
                        <span className="ml-1">Close</span>
                    </div>
                </div>
            </div>
        </CommandDialog>
    );
}
