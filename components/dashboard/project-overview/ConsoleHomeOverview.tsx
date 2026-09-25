"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GenerateKeyDialog } from "@/components/api-keys/GenerateKeyDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabaseClient";
import { formatCurrency } from "@/lib/currency";
import { queryKeys } from "@/lib/hooks/useQueries";

interface ConsoleHomeOverviewProps {
    orgId: string;
    orgName: string;
    orgSlug: string;
    projectId: string;
    projectName: string;
    projectSlug: string;
    initialBalance: number | null;
    initialFirstName: string | null;
    consoleMode?: boolean;
}

function greetingForHour(hour: number): "morning" | "afternoon" | "evening" {
    if (hour < 12) return "morning";
    if (hour < 18) return "afternoon";
    return "evening";
}

function useFirstName(initialFirstName: string | null) {
    const { data } = useQuery({
        queryKey: ["consoleHomeProfile"],
        queryFn: async () => {
            const sessionResult = await supabase.auth.getSession();
            const meta = sessionResult.data.session?.user.user_metadata;
            const metaName: string | null =
                meta?.first_name || meta?.given_name || meta?.name?.split(" ")[0] || null;

            try {
                const response = await fetch("/api/user/profile");
                if (response.ok) {
                    const json = await response.json();
                    const profile = json?.profile;
                    if (profile?.first_name) return profile.first_name as string;
                }
            } catch {
                // Fall through to session metadata.
            }

            return metaName;
        },
        staleTime: 5 * 60 * 1000,
        placeholderData: initialFirstName,
    });

    return data ?? initialFirstName;
}

function useCreditsBalance(orgId: string, initialBalance: number | null) {
    return useQuery({
        queryKey: ["consoleHomeCredits", orgId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("organizations")
                .select("credits_balance")
                .eq("id", orgId)
                .single();
            if (error || !data) throw new Error("Could not load credits balance");
            return Number(data.credits_balance ?? 0);
        },
        staleTime: 30 * 1000,
        placeholderData: initialBalance ?? undefined,
    });
}

function useApiKeyCount(projectId: string) {
    return useQuery({
        queryKey: queryKeys.apiKeys(projectId),
        queryFn: async () => {
            const response = await fetch(`/api/projects/${projectId}/api-keys`);
            if (!response.ok) throw new Error("Could not load API keys");
            const json = await response.json();
            const keys = (json?.apiKeys || json?.keys || []) as unknown[];
            return keys.length;
        },
        staleTime: 30 * 1000,
    });
}

export function ConsoleHomeOverview({
    orgId,
    orgSlug,
    projectId,
    initialBalance,
    initialFirstName,
    consoleMode = true,
}: ConsoleHomeOverviewProps) {
    const queryClient = useQueryClient();
    const [showGenerateKeyDialog, setShowGenerateKeyDialog] = useState(false);

    const firstName = useFirstName(initialFirstName);
    const { data: balance, isLoading: balanceLoading } = useCreditsBalance(orgId, initialBalance);
    const { data: keyCount, isLoading: keysLoading } = useApiKeyCount(projectId);

    const greeting = greetingForHour(new Date().getHours());
    const billingHref = consoleMode ? "/billing" : `/${orgSlug}/~/billing`;

    return (
        <section className="mx-auto w-full max-w-[1360px] px-6 py-8">
            <header className="mb-6">
                <h1 className="text-base font-medium">
                    Good {greeting}{firstName ? `, ${firstName}` : ""}
                </h1>
            </header>

            <h2 className="mb-3 text-sm font-medium tracking-[-0.02em]">
                Setup
            </h2>
            <article className="flex min-h-44 flex-col rounded-md bg-muted/60 p-5">
                <div className="mt-auto flex items-end justify-between gap-4 pt-3">
                    <div className="min-w-0">
                        <p className="text-2xl font-medium tracking-tight">
                            Integrate Cencori API
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Follow the path that matches what you&apos;re building.
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                    <Button asChild size="sm" className="h-7 text-xs">
                        <Link href="/docs/quick-start#3-new-product-scaffold-an-app">New product</Link>
                    </Button>
                    <Button asChild size="sm" className="h-7 text-xs">
                        <Link href="/docs/quick-start#4-existing-product-follow-the-dashboard-to-code-guide">
                            Existing product
                        </Link>
                    </Button>
                    </div>
                </div>
            </article>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">

                <article className="rounded-md bg-muted/60 p-5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Credits balance
                    </p>
                    {balanceLoading && balance == null ? (
                        <div className="mt-3 space-y-2">
                            <Skeleton className="h-8 w-32" />
                            <Skeleton className="h-3 w-48" />
                        </div>
                    ) : (
                        <>
                            <p className="mt-3 font-mono text-2xl font-medium tracking-tight tabular-nums">
                                {formatCurrency(Number(balance ?? 0), "USD", {
                                    maximumFractionDigits: 2,
                                    minimumFractionDigits: 2,
                                })}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Prepaid balance for managed model usage.
                            </p>
                        </>
                    )}
                    <div className="mt-4">
                        <Button asChild size="sm" className="h-7 text-xs">
                            <Link href={billingHref}>Top up credits</Link>
                        </Button>
                    </div>
                </article>

                <article className="rounded-md bg-muted/60 p-5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        API key
                    </p>
                    {keysLoading ? (
                        <div className="mt-3 space-y-2">
                            <Skeleton className="h-8 w-40" />
                            <Skeleton className="h-3 w-48" />
                        </div>
                    ) : (
                        <>
                            <p className="mt-3 text-2xl font-medium tracking-tight">
                                {keyCount === 0
                                    ? "Get your API key"
                                    : `${keyCount} active ${keyCount === 1 ? "key" : "keys"}`}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {keyCount === 0
                                    ? "Create a key to make your first request."
                                    : "Create another key or manage existing ones."}
                            </p>
                        </>
                    )}
                    <div className="mt-4 flex items-center gap-2">
                        <Button
                            type="button"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setShowGenerateKeyDialog(true)}
                        >
                            Create API key
                        </Button>
                    </div>
                </article>
            </div>

            {projectId && (
                <GenerateKeyDialog
                    projectId={projectId}
                    open={showGenerateKeyDialog}
                    onOpenChange={setShowGenerateKeyDialog}
                    defaultKeyType="secret"
                    onKeyGenerated={() => {
                        void queryClient.invalidateQueries({
                            queryKey: queryKeys.apiKeys(projectId),
                        });
                    }}
                />
            )}
        </section>
    );
}
