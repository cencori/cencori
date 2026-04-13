"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Search, X, ChevronDown } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TABS = [
    { slug: "all", label: "All" },
    { slug: "engineering", label: "Engineering" },
    { slug: "product", label: "Product" },
    { slug: "community", label: "Community" },
    { slug: "customers", label: "Customers" },
    { slug: "changelog", label: "Changelog" },
    { slug: "press", label: "Press" },
] as const;

export function BlogTabs() {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [query, setQuery] = useState(searchParams.get("q") || "");

    const getHref = (slug: string) => {
        if (slug === "all") return "/blog";
        if (slug === "changelog" || slug === "press") return `/${slug}`;
        return `/blog/${slug}`;
    };

    const activeCategory = (() => {
        for (const cat of TABS) {
            if (cat.slug !== "all" && pathname === getHref(cat.slug)) {
                return cat.slug;
            }
        }
        return "all";
    })();

    const activeLabel = TABS.find((t) => t.slug === activeCategory)?.label || "All";

    const handleSearch = (value: string) => {
        setQuery(value);
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
            params.set("q", value);
        } else {
            params.delete("q");
        }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    return (
        <div className="flex items-center gap-2">
            {/* Mobile: dropdown */}
            <DropdownMenu>
                <DropdownMenuTrigger className="md:hidden shrink-0 h-8 px-3.5 rounded-full text-xs font-medium border bg-foreground text-background border-foreground inline-flex items-center gap-1.5 focus:outline-none">
                    {activeLabel}
                    <ChevronDown className="h-3 w-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[140px]">
                    {TABS.map((cat) => (
                        <DropdownMenuItem
                            key={cat.slug}
                            onClick={() => router.push(getHref(cat.slug))}
                            className={cn(
                                "text-xs cursor-pointer",
                                activeCategory === cat.slug && "font-semibold"
                            )}
                        >
                            {cat.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Desktop: pill tabs */}
            <div className="hidden md:flex items-center gap-1 overflow-x-auto no-scrollbar flex-1">
                {TABS.map((cat) => {
                    const href = getHref(cat.slug);
                    const isActive = activeCategory === cat.slug;

                    return (
                        <Link
                            key={cat.slug}
                            href={href}
                            className={cn(
                                "shrink-0 h-8 px-3.5 rounded-full text-xs font-medium transition-colors border",
                                isActive
                                    ? "bg-foreground text-background border-foreground"
                                    : "bg-background border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                            )}
                            style={{ display: "inline-flex", alignItems: "center" }}
                        >
                            {cat.label}
                        </Link>
                    );
                })}
            </div>

            {/* Search */}
            <div className="relative shrink-0 md:flex-none ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Search..."
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="h-8 w-36 md:w-64 pl-8 pr-7 text-xs rounded-full border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border transition-colors"
                />
                {query && (
                    <button
                        onClick={() => handleSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="h-3 w-3" />
                    </button>
                )}
            </div>
        </div>
    );
}
