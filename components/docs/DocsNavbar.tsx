// components/DocsNavbar.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from "@/components/ui/sheet";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

const navLinks = [
    { title: "Products", href: "/products" },
    { title: "Solutions", href: "/solutions" },
    { title: "Pricing", href: "/pricing" },
    { title: "Blog", href: siteConfig.links.company.blog },
];

const sidebarItems = [
    {
        title: "Getting Started",
        items: [
            { title: "Introduction", href: "/docs/introduction" },
            { title: "Quick Start", href: "/docs/quick-start" },
            { title: "Installation", href: "/docs/installation" },
            { title: "Making Your First Request", href: "/docs/getting-started/first-request" },
        ],
    },
    {
        title: "Core Concepts",
        items: [
            { title: "Projects", href: "/docs/concepts/projects" },
            { title: "Organizations", href: "/docs/concepts/organizations" },
            { title: "API Keys", href: "/docs/concepts/api-keys" },
            { title: "Multi-Provider", href: "/docs/concepts/multi-provider" },
            { title: "Models", href: "/docs/concepts/models" },
            { title: "Streaming", href: "/docs/concepts/streaming" },
            { title: "Credits System", href: "/docs/concepts/credits" },
            { title: "Rate Limiting", href: "/docs/concepts/rate-limiting" },
            { title: "Security", href: "/docs/concepts/security" },
        ],
    },
    {
        title: "API Reference",
        items: [
            { title: "Authentication", href: "/docs/api/auth" },
            { title: "Chat", href: "/docs/api/chat" },
            { title: "Metrics", href: "/docs/api/metrics" },
            { title: "Projects API", href: "/docs/api/projects" },
            { title: "API Keys API", href: "/docs/api/keys" },
            { title: "Errors", href: "/docs/api/errors" },
        ],
    },
    {
        title: "Guides",
        items: [
            { title: "Migrating from OpenAI", href: "/docs/guides/migrate-openai" },
            { title: "Migrating from Anthropic", href: "/docs/guides/migrate-anthropic" },
            { title: "Custom Providers", href: "/docs/guides/custom-providers" },
            { title: "Cost Optimization", href: "/docs/guides/cost-optimization" },
        ],
    },
    {
        title: "Security",
        items: [
            { title: "PII Detection", href: "/docs/security/pii-detection" },
        ],
    },
    {
        title: "Use Cases",
        items: [
            { title: "For Context Engineers", href: "/docs/use-cases/vibe-coders" },
            { title: "For AI Companies", href: "/docs/use-cases/ai-companies" },
        ],
    },
];

export function DocsNavbar() {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();

    return (
        <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur border-b border-border/40">
            <div className="container mx-auto px-4 md:px-6">
                <div className="flex h-14 items-center justify-between gap-4">
                    {/* Logo */}
                    <div className="flex items-center gap-6">
                        <Link href="/docs" className="flex items-center gap-2">
                            <Logo variant="mark" className="h-5" />
                            <span className="font-semibold text-sm">Docs</span>
                        </Link>
                    </div>

                    {/* Desktop nav links */}
                    <nav className="hidden md:flex items-center gap-1">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted/50"
                            >
                                {link.title}
                            </Link>
                        ))}
                    </nav>

                    {/* Right side actions */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            className="hidden md:inline-flex h-7 px-3 text-xs font-medium rounded-full hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                            asChild
                        >
                            <Link href={siteConfig.links.signInUrl}>Sign in</Link>
                        </Button>
                        <Button
                            variant="default"
                            className="hidden md:inline-flex rounded-full bg-foreground text-background hover:bg-foreground/90 h-7 px-3 text-xs font-medium"
                            asChild
                        >
                            <Link href={siteConfig.links.getStartedUrl}>Get Started</Link>
                        </Button>

                        {/* Mobile menu button */}
                        <Sheet open={open} onOpenChange={setOpen}>
                            <SheetTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="md:hidden h-9 w-9"
                                    aria-label="Open menu"
                                >
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-full p-0">
                                <div className="flex flex-col h-full">
                                    <div className="px-6 py-6 border-b border-border/40">
                                        <Link href="/docs" className="flex items-center gap-3" onClick={() => setOpen(false)}>
                                            <Logo variant="mark" className="h-6" />
                                            <span className="font-semibold">Docs</span>
                                        </Link>
                                    </div>
                                    <nav className="flex-1 overflow-y-auto px-6 py-4">
                                        <Accordion type="multiple" defaultValue={sidebarItems.map(g => g.title)} className="w-full space-y-4">
                                            {sidebarItems.map((group, index) => (
                                                <AccordionItem key={index} value={group.title} className="border-none">
                                                    <AccordionTrigger className="py-2 text-sm font-semibold hover:no-underline hover:text-primary transition-colors text-foreground/90">
                                                        {group.title}
                                                    </AccordionTrigger>
                                                    <AccordionContent className="pb-2">
                                                        <ul className="space-y-1 border-l border-border/40 ml-2 pl-4 mt-1">
                                                            {group.items.map((item, itemIndex) => {
                                                                const isActive = pathname === item.href;
                                                                return (
                                                                    <li key={itemIndex}>
                                                                        <Link
                                                                            href={item.href}
                                                                            onClick={() => setOpen(false)}
                                                                            className={cn(
                                                                                "block text-sm py-1.5 transition-colors hover:text-foreground",
                                                                                isActive
                                                                                    ? "text-primary font-medium"
                                                                                    : "text-muted-foreground"
                                                                            )}
                                                                        >
                                                                            {item.title}
                                                                        </Link>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            ))}
                                        </Accordion>
                                    </nav>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
            </div>
        </header>
    );
}
