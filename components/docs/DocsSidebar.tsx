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
        title: "AI",
        items: [
            { title: "Overview", href: "/docs/ai" },
            { title: "Observability", href: "/docs/ai/observability" },
            { title: "Routing & Failover", href: "/docs/ai/routing-failover" },
            { title: "Caching", href: "/docs/ai/caching" },
            { title: "AI Gateway", href: "/docs/ai/gateway" },
            { title: "Node.js SDK", href: "/docs/ai/sdk" },
            { title: "Python SDK", href: "/docs/ai/python-sdk" },
            { title: "Go SDK", href: "/docs/ai/go-sdk" },
            { title: "Universal Proxy", href: "/docs/ai/universal-proxy" },
            { title: "SDK Configuration", href: "/docs/ai/sdk-configuration" },
            { title: "Vercel AI SDK", href: "/docs/ai/vercel-sdk" },
            { title: "TanStack AI", href: "/docs/ai/tanstack" },
            { title: "Providers", href: "/docs/ai/providers" },
            { title: "Failover", href: "/docs/ai/failover" },
            { title: "Streaming", href: "/docs/ai/streaming" },
            { title: "Tool Calling", href: "/docs/ai/tool-calling" },
            { title: "Structured Output", href: "/docs/ai/structured-output" },
        ],
    },
    {
        title: "Endpoints",
        items: [
            { title: "Chat", href: "/docs/ai/endpoints/chat" },
            { title: "Images", href: "/docs/ai/endpoints/images" },
            { title: "Embeddings", href: "/docs/ai/endpoints/embeddings" },
            { title: "Audio", href: "/docs/ai/endpoints/audio" },
            { title: "Moderation", href: "/docs/ai/endpoints/moderation" },
        ],
    },
    {
        title: "Platform",
        items: [
            { title: "Architecture", href: "/docs/platform/core-architecture" },
            { title: "Projects", href: "/docs/platform/projects" },
            { title: "Billing & Usage", href: "/docs/platform/billing" },
            { title: "Bring Your Own Key", href: "/docs/platform/byok" },
            { title: "API Keys", href: "/docs/platform/api-keys" },
            { title: "Organizations", href: "/docs/platform/organizations" },
            { title: "Credits System", href: "/docs/platform/credits" },
            { title: "Rate Limiting", href: "/docs/platform/rate-limiting" },
            { title: "Agent Frameworks", href: "/docs/platform/agent-frameworks" },
        ],
    },
    {
        title: "Memory",
        items: [
            { title: "Overview", href: "/docs/ai/memory" },
            { title: "Namespaces", href: "/docs/ai/memory/namespaces" },
            { title: "Store & Search", href: "/docs/ai/memory/store-search" },
            { title: "Vector Store", href: "/docs/ai/memory/vector-store" },
            { title: "Filtering & Search", href: "/docs/ai/memory/filtering" },
            { title: "RAG", href: "/docs/ai/memory/rag" },
        ],
    },
    {
        title: "Security",
        items: [
            { title: "Cencori Scan", href: "/docs/security/scan" },
            { title: "PII Detection", href: "/docs/security/pii-detection" },
            { title: "Prompt Injection", href: "/docs/security/prompt-injection" },
            { title: "Content Filtering", href: "/docs/security/content-filtering" },
            { title: "Web Dashboard", href: "/docs/security/scan/web-dashboard" },
            { title: "Security Incidents", href: "/docs/security/incidents" },
        ],
    },
    {
        title: "Integrations",
        items: [
            { title: "Vercel AI SDK", href: "/docs/integrations/vercel-ai-sdk" },
            { title: "TanStack AI", href: "/docs/integrations/tanstack" },
            { title: "LangChain", href: "/docs/integrations/langchain" },
            { title: "Agent Frameworks", href: "/docs/integrations/agent-frameworks" },
            { title: "Backend & DB", href: "/docs/integrations/backend" },
            { title: "Automation", href: "/docs/integrations/automation" },
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
        title: "API Reference",
        items: [
            { title: "Authentication", href: "/docs/api/auth" },
            { title: "Projects API", href: "/docs/api/projects" },
            { title: "API Keys API", href: "/docs/api/keys" },
            { title: "Metrics", href: "/docs/api/metrics" },
            { title: "Errors", href: "/docs/api/errors" },
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
        <aside className={cn("w-64 shrink-0 hidden md:block border-r border-border/40 h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto bg-background/50 backdrop-blur-sm", className)}>
            <div className="px-3 py-6 lg:py-8">
                <Accordion type="multiple" defaultValue={[activeSection]} className="w-full space-y-2">
                    {sidebarItems.map((group, index) => (
                        <AccordionItem key={index} value={group.title} className="border-none">
                            <AccordionTrigger className="py-1.5 px-3 text-xs font-medium hover:no-underline hover:text-foreground transition-all text-muted-foreground data-[state=open]:text-foreground decoration-none">
                                {group.title}
                            </AccordionTrigger>
                            <AccordionContent className="pb-1 mt-1">
                                <ul className="relative ml-3.5 border-l border-border/60">
                                    {group.items.map((item, itemIndex) => {
                                        const isActive = pathname === item.href;
                                        return (
                                            <li key={itemIndex} className="relative">
                                                <Link
                                                    href={item.href}
                                                    className={cn(
                                                        "group flex items-center gap-2 py-1.5 pl-4 pr-3 text-[13px] transition-all relative",
                                                        isActive
                                                            ? "text-foreground font-medium bg-muted/50 rounded-md"
                                                            : "text-muted-foreground hover:text-foreground"
                                                    )}
                                                >
                                                    {/* The vertical active indicator line */}
                                                    {isActive && (
                                                        <div className="absolute left-[-1px] top-0 bottom-0 w-[2px] bg-foreground rounded-full z-10" />
                                                    )}
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
