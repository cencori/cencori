"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, ExternalLink, Settings } from "lucide-react";
import Link from "next/link";

// Inline GitHub icon
const GitHubIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
);

// Integration card data
interface Integration {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    docsUrl?: string;
}

const integrations: Integration[] = [
    {
        id: "github",
        name: "GitHub",
        description: "Import repositories and sync your projects with GitHub",
        icon: <GitHubIcon className="h-8 w-8" />,
        docsUrl: "https://docs.github.com/en/apps",
    },
    {
        id: "supabase",
        name: "Supabase",
        description: "Connect your Supabase projects for database and auth",
        icon: (
            <svg className="h-8 w-8" viewBox="0 0 109 113" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint0_linear)" />
                <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint1_linear)" fillOpacity="0.2" />
                <path d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.16513 56.4175L45.317 2.07103Z" fill="#3ECF8E" />
                <defs>
                    <linearGradient id="paint0_linear" x1="53.9738" y1="54.974" x2="94.1635" y2="71.8295" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#249361" />
                        <stop offset="1" stopColor="#3ECF8E" />
                    </linearGradient>
                    <linearGradient id="paint1_linear" x1="36.1558" y1="30.578" x2="54.4844" y2="65.0806" gradientUnits="userSpaceOnUse">
                        <stop />
                        <stop offset="1" stopOpacity="0" />
                    </linearGradient>
                </defs>
            </svg>
        ),
        docsUrl: "https://supabase.com/docs",
    },
    {
        id: "vercel",
        name: "Vercel",
        description: "Deploy and host your projects with Vercel",
        icon: (
            <svg className="h-8 w-8" viewBox="0 0 76 65" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
            </svg>
        ),
        docsUrl: "https://vercel.com/docs",
    },
];

// GitHub installation status hook
function useGitHubStatus(orgSlug: string) {
    return useQuery({
        queryKey: ["github-status", orgSlug],
        queryFn: async () => {
            // Get organization ID first
            const { data: org } = await supabase
                .from("organizations")
                .select("id")
                .eq("slug", orgSlug)
                .single();

            if (!org) return { connected: false, installation: null };

            // Check if there's a GitHub installation for this org
            const { data: installation } = await supabase
                .from("organization_github_installations")
                .select(`
                    installation_id,
                    github_app_installations (
                        github_account_login,
                        github_account_type
                    )
                `)
                .eq("organization_id", org.id)
                .single();

            if (installation) {
                return {
                    connected: true,
                    installation: {
                        id: installation.installation_id,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        accountLogin: (installation.github_app_installations as any)?.github_account_login,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        accountType: (installation.github_app_installations as any)?.github_account_type,
                    },
                };
            }

            return { connected: false, installation: null };
        },
    });
}

// Integration card component
function IntegrationCard({
    integration,
    isConnected,
    connectionDetails,
    isLoading,
    onConnect,
    onManage,
}: {
    integration: Integration;
    isConnected: boolean;
    connectionDetails?: string;
    isLoading: boolean;
    onConnect: () => void;
    onManage?: () => void;
}) {
    return (
        <Card className="relative">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                            {integration.icon}
                        </div>
                        <div>
                            <CardTitle className="text-base">{integration.name}</CardTitle>
                            {isConnected && connectionDetails && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {connectionDetails}
                                </p>
                            )}
                        </div>
                    </div>
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : isConnected ? (
                        <Badge variant="secondary" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Connected
                        </Badge>
                    ) : null}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <CardDescription>{integration.description}</CardDescription>
                <div className="flex items-center gap-2">
                    {isConnected ? (
                        <>
                            {onManage && (
                                <Button variant="outline" size="sm" onClick={onManage}>
                                    <Settings className="h-4 w-4 mr-1" />
                                    Manage
                                </Button>
                            )}
                        </>
                    ) : (
                        <Button size="sm" onClick={onConnect} disabled={isLoading}>
                            Connect
                        </Button>
                    )}
                    {integration.docsUrl && (
                        <Button variant="ghost" size="sm" asChild>
                            <Link href={integration.docsUrl} target="_blank">
                                <ExternalLink className="h-4 w-4 mr-1" />
                                Docs
                            </Link>
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export default function IntegrationsPage() {
    const params = useParams();
    const orgSlug = params.orgSlug as string;

    // GitHub status
    const { data: githubStatus, isLoading: githubLoading } = useGitHubStatus(orgSlug);

    const handleGitHubConnect = () => {
        // Redirect to GitHub import page which handles the installation flow
        window.location.href = `/dashboard/organizations/${orgSlug}/projects/import/github`;
    };

    const handleGitHubManage = () => {
        if (githubStatus?.installation?.id) {
            window.open(
                `https://github.com/settings/installations/${githubStatus.installation.id}`,
                "_blank"
            );
        }
    };

    const handleSupabaseConnect = () => {
        // TODO: Implement Supabase OAuth flow
        alert("Supabase integration coming soon!");
    };

    const handleVercelConnect = () => {
        // TODO: Implement Vercel OAuth flow
        alert("Vercel integration coming soon!");
    };

    return (
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="pb-8">
                <h1 className="text-xl font-bold">Integrations</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Connect your favorite tools and services
                </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {/* GitHub */}
                <IntegrationCard
                    integration={integrations[0]}
                    isConnected={githubStatus?.connected || false}
                    connectionDetails={
                        githubStatus?.installation
                            ? `@${githubStatus.installation.accountLogin}`
                            : undefined
                    }
                    isLoading={githubLoading}
                    onConnect={handleGitHubConnect}
                    onManage={githubStatus?.connected ? handleGitHubManage : undefined}
                />

                {/* Supabase */}
                <IntegrationCard
                    integration={integrations[1]}
                    isConnected={false}
                    isLoading={false}
                    onConnect={handleSupabaseConnect}
                />

                {/* Vercel */}
                <IntegrationCard
                    integration={integrations[2]}
                    isConnected={false}
                    isLoading={false}
                    onConnect={handleVercelConnect}
                />
            </div>
        </div>
    );
}
