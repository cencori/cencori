// components/DocsNavbar.tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GitHubStarsButton } from "@/components/animate-ui/components/buttons/github-stars";
import { DocsThemeToggle } from "./DocsThemeToggle";

export function DocsNavbar() {
    const [query, setQuery] = useState("");
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const isMac = navigator.platform.toUpperCase().includes("MAC");
            if ((isMac && e.metaKey && e.key.toLowerCase() === "k") || (!isMac && e.ctrlKey && e.key.toLowerCase() === "k")) {
                e.preventDefault();
                inputRef.current?.focus();
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    return (
        <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur border-b border-border/40">
            <div className="container mx-auto px-4 md:px-6">
                <div className="flex h-16 items-center justify-between gap-4">
                    <div className="flex items-center min-w-[160px]">
                        <Link href="/docs" className="flex items-center gap-3">
                            <Logo variant="mark" className="h-6" />
                            <span className="hidden sm:inline-block font-semibold">Docs</span>
                        </Link>
                    </div>

                    <div className="flex-1 flex justify-center">
                        <div className="w-full max-w-2xl">
                            <label className="relative block">
                                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    ref={inputRef}
                                    type="search"
                                    placeholder="Search documentation..."
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className="w-full pl-10 pr-12 h-10 rounded-lg shadow-sm bg-muted/50 border-border/30 focus-visible:outline-none focus:ring-2 focus:ring-ring"
                                    aria-label="Search documentation"
                                />
                                <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden h-6 select-none items-center gap-1 rounded border border-border/40 bg-muted px-2 font-mono text-xs font-medium sm:flex">
                                    <span className="text-xs">⌘</span>
                                    <span>K</span>
                                </kbd>
                            </label>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 min-w-[160px] justify-end">
              <svg className="mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
                <path
                  d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                  fill="currentColor"
                />
              </svg>

                        <DocsThemeToggle />

                        <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden h-9 w-9"
                            onClick={() => inputRef.current?.focus()}
                            aria-label="Open search"
                        >
                            <Search className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="md:hidden mt-3 pb-3">
                    <div className="px-1">
                        <label className="relative block">
                            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                ref={inputRef}
                                type="search"
                                placeholder="Search documentation..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="w-full pl-10 h-10 rounded-lg bg-muted/50"
                                aria-label="Search documentation mobile"
                            />
                        </label>
                    </div>
                </div>
            </div>
        </header>
    );
}
