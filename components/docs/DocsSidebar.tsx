"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

interface DocsSidebarProps {
    className?: string;
}

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
            { title: "Failover", href: "/docs/concepts/failover" },
            { title: "Models", href: "/docs/concepts/models" },
            { title: "Streaming", href: "/docs/concepts/streaming" },
            { title: "Credits System", href: "/docs/concepts/credits" },
            { title: "Rate Limiting", href: "/docs/concepts/rate-limiting" },
            { title: "Security", href: "/docs/concepts/security" },
            { title: "Agent Frameworks", href: "/docs/concepts/agent-frameworks" },
            { title: "Comparison", href: "/docs/concepts/comparison" },
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
            { title: "Audit Logs", href: "/docs/guides/audit-logs" },
            { title: "Analytics", href: "/docs/guides/analytics" },
        ],
    },
    {
        title: "Security",
        items: [
            { title: "Cencori Scan", href: "/docs/security/scan" },
            { title: "PII Detection", href: "/docs/security/pii-detection" },
            { title: "Prompt Injection", href: "/docs/security/prompt-injection" },
            { title: "Content Filtering", href: "/docs/security/content-filtering" },
            { title: "Security Incidents", href: "/docs/security/incidents" },
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

export function DocsSidebar({ className }: DocsSidebarProps) {
    const pathname = usePathname();

    // Find the section that contains the current active link to open it by default
    const activeSection = sidebarItems.find(group =>
        group.items.some(item => pathname === item.href)
    )?.title || "Getting Started";

    return (
        <aside className={cn("w-64 shrink-0 hidden md:block border-r border-border/40 h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto", className)}>
            <div className="px-4 py-6 lg:py-8">
                <Accordion type="multiple" defaultValue={[activeSection]} className="w-full space-y-4">
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
            </div>
        </aside>
    );
}
