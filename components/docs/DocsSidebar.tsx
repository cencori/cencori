"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { TechnicalBorder } from "@/components/landing/TechnicalBorder";

interface DocsSidebarProps {
    className?: string;
}

const sidebarItems = [
    {
        title: "Getting Started",
        items: [
            { title: "Introduction", href: "/docs" },
            { title: "Quick Start", href: "/docs/quick-start" },
        ],
    },
    {
        title: "Use Cases",
        items: [
            { title: "For Context Engineers", href: "/docs/use-cases/vibe-coders" },
            { title: "For AI Companies", href: "/docs/use-cases/ai-companies" },
        ],
    },
    {
        title: "Core Concepts",
        items: [
            { title: "Security", href: "/docs/concepts/security" },
            { title: "Projects", href: "/docs/concepts/projects" },
        ],
    },
    {
        title: "API Reference",
        items: [
            { title: "Authentication", href: "/docs/api/auth" },
            { title: "Chat", href: "/docs/api/chat" },
        ],
    },
];

export function DocsSidebar({ className }: DocsSidebarProps) {
    const pathname = usePathname();

    return (
        <aside className={cn("w-64 shrink-0 hidden md:block border-r border-border/40 h-[calc(100vh-4rem)] px-4 py-12 lg:py-20 sticky top-16 overflow-y-auto py-6 pr-6", className)}>
            <div className="space-y-6">
                {sidebarItems.map((group, index) => (
                    <div key={index}>
                        <h4 className="font-medium text-sm mb-2 text-foreground/90">{group.title}</h4>
                        <ul className="space-y-1">
                            {group.items.map((item, itemIndex) => {
                                const isActive = pathname === item.href;
                                return (
                                    <li key={itemIndex}>
                                        <Link
                                            href={item.href}
                                            className={cn(
                                                "block text-sm py-1.5 px-2 transition-colors hover:text-foreground/80",
                                                isActive
                                                    ? "text-foreground font-medium bg-accent/50"
                                                    : "text-muted-foreground"
                                            )}
                                        >
                                            {isActive ? (
                                                <TechnicalBorder cornerSize={4} borderWidth={1} className="p-0">
                                                    <div className="px-2 py-1.5">
                                                        {item.title}
                                                    </div>
                                                </TechnicalBorder>
                                            ) : (
                                                <div className="px-2 py-1.5 border border-transparent">
                                                    {item.title}
                                                </div>
                                            )}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </div>
        </aside>
    );
}
