"use client";

import { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function DocsSearch() {
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
        <div className="sticky top-[57px] z-40 w-full bg-background/95 backdrop-blur border-b border-border/40">
            <div className="container mx-auto px-4 md:px-6 py-3">
                <div className="max-w-2xl mx-auto">
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
        </div>
    );
}
