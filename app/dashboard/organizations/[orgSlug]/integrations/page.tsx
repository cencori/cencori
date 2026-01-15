"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Terminal, Blocks } from "lucide-react";
import { Microsoft, GoogleCloud, Cloudflare } from "@lobehub/icons";
import Link from "next/link";

// SDK section
const sdks = [
    {
        name: "TypeScript / JavaScript",
        package: "cencori",
        installCmd: "npm install cencori",
        docsUrl: "/docs/installation",
        status: "stable" as const,
    },
    {
        name: "Python",
        package: "cencori",
        installCmd: "pip install cencori",
        docsUrl: "/docs/installation",
        status: "stable" as const,
    },
    {
        name: "Go",
        package: "github.com/cencori/cencori-go",
        installCmd: "go get github.com/cencori/cencori-go",
        docsUrl: "/docs/installation",
        status: "coming-soon" as const,
    },
];

// Platform integrations
const platforms = [
    {
        name: "Vercel",
        description: "One-click install from Vercel Marketplace",
        icon: (
            <svg className="h-6 w-6" viewBox="0 0 76 65" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
            </svg>
        ),
        url: "https://vercel.com/integrations",
        status: "coming-q2" as const,
    },
    {
        name: "Supabase",
        description: "Database extension for seamless integration",
        icon: (
            <svg className="h-6 w-6" viewBox="0 0 109 113" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="#3ECF8E" />
                <path d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.16513 56.4175L45.317 2.07103Z" fill="#3ECF8E" />
            </svg>
        ),
        url: "https://supabase.com/partners",
        status: "coming-q2" as const,
    },
    {
        name: "Cloudflare",
        description: "Edge runtime integration for AI Gateway",
        icon: <Cloudflare.Color size={24} />,
        url: "https://cloudflare.com",
        status: "coming-q3" as const,
    },
];

// Developer tools
const devTools = [
    {
        name: "GitHub Actions",
        description: "CI/CD workflows for prompt testing and security scanning",
        icon: (
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
        ),
        status: "coming-soon" as const,
    },
    {
        name: "Terraform Provider",
        description: "Infrastructure-as-code for Cencori resources",
        icon: <Blocks className="h-6 w-6 text-purple-500" />,
        status: "coming-soon" as const,
    },
    {
        name: "CLI",
        description: "Command-line interface for local development",
        icon: <Terminal className="h-6 w-6" />,
        status: "coming-soon" as const,
    },
];

// Enterprise connectors
const enterprise = [
    {
        name: "Microsoft Purview",
        description: "Data loss prevention integration",
        icon: <Microsoft.Color size={24} />,
        status: "enterprise" as const,
    },
    {
        name: "Google Cloud DLP",
        description: "Sensitive data protection integration",
        icon: <GoogleCloud.Color size={24} />,
        status: "enterprise" as const,
    },
];

// Agent frameworks
const frameworks = [
    {
        name: "LangChain",
        description: "Use Cencori as your LLM provider",
        docsUrl: "/docs/integrations#sdk-integrations",
        status: "stable" as const,
    },
    {
        name: "Vercel AI SDK",
        description: "Drop-in replacement for OpenAI",
        docsUrl: "/docs/integrations#sdk-integrations",
        status: "stable" as const,
    },
    {
        name: "TanStack AI",
        description: "Community adapter available",
        docsUrl: "/docs/integrations#sdk-integrations",
        status: "stable" as const,
    },
];

function StatusBadge({ status }: { status: "stable" | "coming-soon" | "coming-q2" | "coming-q3" | "enterprise" }) {
    const variants = {
        stable: { label: "Available", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
        "coming-soon": { label: "Coming Soon", className: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
        "coming-q2": { label: "Q2 2026", className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
        "coming-q3": { label: "Q3 2026", className: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
        enterprise: { label: "Enterprise", className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
    };
    const v = variants[status];
    return <Badge variant="outline" className={v.className}>{v.label}</Badge>;
}

export default function IntegrationsPage() {
    return (
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-10">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold">Integrations</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Connect Cencori to your stack
                </p>
            </div>

            {/* SDKs */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-lg font-semibold">SDKs</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {sdks.map((sdk) => (
                        <Card key={sdk.name}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">{sdk.name}</CardTitle>
                                    <StatusBadge status={sdk.status} />
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <code className="block text-xs bg-muted px-3 py-2 rounded font-mono">
                                    {sdk.installCmd}
                                </code>
                                {sdk.status === "stable" && (
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href={sdk.docsUrl}>
                                            View Docs <ExternalLink className="h-3 w-3 ml-1" />
                                        </Link>
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Agent Frameworks */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-lg font-semibold">Agent Frameworks</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {frameworks.map((fw) => (
                        <Card key={fw.name}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">{fw.name}</CardTitle>
                                    <StatusBadge status={fw.status} />
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <CardDescription>{fw.description}</CardDescription>
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={fw.docsUrl} target={fw.docsUrl.startsWith("http") ? "_blank" : undefined}>
                                        View Docs <ExternalLink className="h-3 w-3 ml-1" />
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Platform Marketplaces */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-lg font-semibold">Platform Marketplaces</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {platforms.map((platform) => (
                        <Card key={platform.name} className="relative">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-muted">
                                            {platform.icon}
                                        </div>
                                        <CardTitle className="text-base">{platform.name}</CardTitle>
                                    </div>
                                    <StatusBadge status={platform.status} />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>{platform.description}</CardDescription>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Developer Tools */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-lg font-semibold">Developer Tools</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {devTools.map((tool) => (
                        <Card key={tool.name}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-muted">
                                            {tool.icon}
                                        </div>
                                        <CardTitle className="text-base">{tool.name}</CardTitle>
                                    </div>
                                    <StatusBadge status={tool.status} />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>{tool.description}</CardDescription>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Enterprise */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-lg font-semibold">Enterprise Connectors</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {enterprise.map((ent) => (
                        <Card key={ent.name}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-muted">
                                            {ent.icon}
                                        </div>
                                        <CardTitle className="text-base">{ent.name}</CardTitle>
                                    </div>
                                    <StatusBadge status={ent.status} />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>{ent.description}</CardDescription>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>
        </div>
    );
}
