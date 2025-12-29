"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "next-themes";

const principles = [
    {
        title: "Dense but Breathable",
        description: "Pack information tightly while maintaining visual hierarchy through whitespace.",
    },
    {
        title: "Subtle Sophistication",
        description: "Muted colors, soft borders, understated hover effects.",
    },
    {
        title: "Developer-First",
        description: "Design for power users who value efficiency over hand-holding.",
    },
];

const quickLinks = [
    { name: "Typography", href: "/design/typography", description: "Text scale and font weights" },
    { name: "Colors", href: "/design/colors", description: "Semantic colors and accents" },
    { name: "Components", href: "/design/components", description: "Buttons, cards, badges" },
    { name: "Layouts", href: "/design/layouts", description: "Page templates" },
];

export default function DesignIntroPage() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div className="space-y-10">
            {/* Hero */}
            <div className="space-y-3">
                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[10px]">
                    v1.2
                </Badge>
                <h1 className="text-2xl font-bold tracking-tight">
                    Cenpact Design System
                </h1>
                <p className="text-sm text-muted-foreground max-w-xl">
                    <strong className="text-foreground">Cenpact</strong> = Cencori + Compact. A design philosophy prioritizing
                    information density, subtle elegance, and developer-focused UX.
                </p>
            </div>

            {/* Core Principles - Compact List */}
            <section className="space-y-3">
                <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Core Principles</h2>
                <div className="border border-border/40 rounded-lg divide-y divide-border/40">
                    {principles.map((item) => (
                        <div key={item.title} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 px-4 py-3">
                            <span className="text-sm font-medium shrink-0 sm:w-44">{item.title}</span>
                            <span className="text-xs text-muted-foreground">{item.description}</span>
                        </div>
                    ))}
                    {/* Dark Mode Native - Inline with toggle on right */}
                    <div className="flex flex-col gap-1 px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">Dark Mode Native</span>
                            {/* Theme Switcher */}
                            <div className="flex w-fit rounded-full border border-border/40 bg-muted/30 shrink-0 sm:hidden">
                                <button
                                    onClick={() => setTheme('light')}
                                    className={`relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-all ${mounted && theme === 'light'
                                        ? 'bg-foreground text-background'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    aria-label="Light mode"
                                >
                                    <SunIcon className="h-3 w-3" />
                                </button>
                                <button
                                    onClick={() => setTheme('dark')}
                                    className={`relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-all ${mounted && theme === 'dark'
                                        ? 'bg-foreground text-background'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    aria-label="Dark mode"
                                >
                                    <MoonIcon className="h-3 w-3" />
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-xs text-muted-foreground">Design dark first, adapt for light. Try switching!</span>
                            {/* Theme Switcher - Desktop only */}
                            <div className="hidden sm:flex w-fit rounded-full border border-border/40 bg-muted/30 shrink-0">
                                <button
                                    onClick={() => setTheme('light')}
                                    className={`relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-all ${mounted && theme === 'light'
                                        ? 'bg-foreground text-background'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    aria-label="Light mode"
                                >
                                    <SunIcon className="h-3 w-3" />
                                </button>
                                <button
                                    onClick={() => setTheme('dark')}
                                    className={`relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-all ${mounted && theme === 'dark'
                                        ? 'bg-foreground text-background'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    aria-label="Dark mode"
                                >
                                    <MoonIcon className="h-3 w-3" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Quick Links */}
            <section className="space-y-3">
                <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Quick Links</h2>
                <div className="grid gap-2 md:grid-cols-2">
                    {quickLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="group flex items-center justify-between rounded-lg border border-border/40 bg-card/50 px-4 py-3 hover:border-border hover:bg-card transition-all"
                        >
                            <div>
                                <h3 className="text-sm font-medium group-hover:text-foreground">
                                    {link.name}
                                </h3>
                                <p className="text-[11px] text-muted-foreground">
                                    {link.description}
                                </p>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                    ))}
                </div>
            </section>

            {/* Get Started */}
            <section className="rounded-lg border border-border/40 bg-muted/20 px-6 py-5 text-center">
                <h2 className="text-sm font-semibold mb-1">Ready to build?</h2>
                <p className="text-xs text-muted-foreground mb-3">
                    Start with the typography scale and color system.
                </p>
                <Button size="sm" className="h-7 px-3 text-xs rounded-full" asChild>
                    <Link href="/design/typography">
                        Get Started
                        <ArrowRight className="h-3 w-3 ml-1.5" />
                    </Link>
                </Button>
            </section>
        </div>
    );
}
