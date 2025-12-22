"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ViewColumnsIcon, SparklesIcon, CommandLineIcon, MoonIcon, SunIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "next-themes";

const highlights = [
    {
        title: "Dense but Breathable",
        description: "Pack information tightly while maintaining visual hierarchy through whitespace.",
        icon: ViewColumnsIcon,
    },
    {
        title: "Subtle Sophistication",
        description: "Prefer muted colors, soft borders, and understated hover effects.",
        icon: SparklesIcon,
    },
    {
        title: "Developer-First",
        description: "Design for power users who value efficiency over hand-holding.",
        icon: CommandLineIcon,
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

    // Avoid hydration mismatch - only show theme toggle after mount
    React.useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div className="space-y-12">
            {/* Hero */}
            <div className="space-y-4">
                <Badge variant="outline" className="rounded-full px-3 py-0.5 text-[10px]">
                    v1.2
                </Badge>
                <h1 className="text-3xl font-bold tracking-tight">
                    Cenpact Design System
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl">
                    <strong>Cenpact</strong> = Cencori + Compact. A design philosophy prioritizing
                    information density, subtle elegance, and developer-focused UX.
                </p>
            </div>

            {/* Core Principles */}
            <section className="space-y-4">
                <h2 className="text-lg font-semibold">Core Principles</h2>
                <div className="grid gap-4 md:grid-cols-3">
                    {highlights.map((item) => (
                        <div
                            key={item.title}
                            className="rounded-xl border border-border/50 bg-card p-5 space-y-3"
                        >
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                <item.icon className="h-5 w-5 text-foreground" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold">{item.title}</h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {item.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Dark Mode Native - Interactive! */}
            <section className="rounded-xl border border-border/50 bg-card p-6">
                <div className="flex items-start gap-4">
                    <button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="w-10 h-10 rounded-lg bg-foreground text-background flex items-center justify-center shrink-0 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                        aria-label="Toggle theme"
                    >
                        {mounted ? (
                            theme === 'dark' ? (
                                <SunIcon className="h-5 w-5" />
                            ) : (
                                <MoonIcon className="h-5 w-5" />
                            )
                        ) : (
                            <MoonIcon className="h-5 w-5" />
                        )}
                    </button>
                    <div>
                        <h3 className="text-sm font-semibold mb-1">
                            Dark Mode Native
                            <Badge variant="outline" className="ml-2 text-[8px] px-1.5 py-0 rounded-full">
                                Try it!
                            </Badge>
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            We design in dark mode first, then adapt for light. Click the icon to toggle!
                        </p>
                    </div>
                </div>
            </section>

            {/* Quick Links */}
            <section className="space-y-4">
                <h2 className="text-lg font-semibold">Quick Links</h2>
                <div className="grid gap-3 md:grid-cols-2">
                    {quickLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="group flex items-center justify-between rounded-lg border border-border/50 bg-card p-4 hover:border-border hover:shadow-sm transition-all"
                        >
                            <div>
                                <h3 className="text-sm font-medium group-hover:text-foreground">
                                    {link.name}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    {link.description}
                                </p>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                    ))}
                </div>
            </section>

            {/* Get Started */}
            <section className="rounded-xl border border-border/50 bg-muted/30 p-6 text-center">
                <h2 className="text-sm font-semibold mb-2">Ready to build?</h2>
                <p className="text-xs text-muted-foreground mb-4">
                    Start with the typography scale and color system.
                </p>
                <Button size="sm" className="rounded-full" asChild>
                    <Link href="/design/typography">
                        Get Started
                        <ArrowRight className="h-3 w-3 ml-1.5" />
                    </Link>
                </Button>
            </section>
        </div>
    );
}
