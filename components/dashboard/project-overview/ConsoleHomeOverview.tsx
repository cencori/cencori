"use client";

import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GenerateKeyDialog } from "@/components/api-keys/GenerateKeyDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabaseClient";
import { formatCurrency } from "@/lib/currency";
import { DitherCanvas, type DitherVariant } from "./DitherCanvas";
import memoryArt from "@/public/console/explore-memory.webp";
import multimodalArt from "@/public/console/explore-multimodal.webp";

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
    // Dedicated cache key — the settings page stores the raw keys array under
    // queryKeys.apiKeys(projectId), which poisoned this count with an object.
    return useQuery({
        queryKey: ["consoleHomeApiKeyCount", projectId],
        queryFn: async (): Promise<number> => {
            const response = await fetch(`/api/projects/${projectId}/api-keys`);
            if (!response.ok) throw new Error("Could not load API keys");
            const json: unknown = await response.json();
            const record = (typeof json === "object" && json !== null ? json : {}) as Record<string, unknown>;
            const candidates = [record.apiKeys, record.keys, record.data, json];
            for (const candidate of candidates) {
                if (Array.isArray(candidate)) return candidate.length;
                if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
            }
            return 0;
        },
        // Always refetch on mount so revokes/creates from other pages are
        // reflected the moment the user comes back here.
        staleTime: 0,
        refetchOnMount: "always",
    });
}

type ExploreApi = {
    // Card artwork, statically imported so Next.js inlines a blurred
    // preview that shows instantly while the full image loads. Without one
    // (and no dither) the 16:9 slot stays empty so the layout never shifts.
    image?: StaticImageData;
    // CSS brightness for the image (1 = as shot); lower for a darker card.
    brightness?: number;
    // Render the slot through the ordered-dither effect: the image if set,
    // otherwise this generated variant.
    dither?: DitherVariant;
    title: string;
    description: string;
    docsHref: string;
};

const EXPLORE_APIS: ExploreApi[] = [
    {
        dither: "clouds",
        title: "Agents API",
        description: "Run multi-turn agents with streamed events and human approval on tool calls.",
        docsHref: "/docs/api/sessions",
    },
    {
        image: memoryArt,
        brightness: 0.45,
        title: "Memory API",
        description: "Give any chat long-term memory with one field, or write and search it directly.",
        docsHref: "/docs/api/memory",
    },
    {
        image: multimodalArt,
        title: "Multimodal API",
        description: "Generate images, speak and transcribe, and read images through one API key.",
        docsHref: "/docs/api/images",
    },
];

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
    const { data: keyCountData, isLoading: keysLoading } = useApiKeyCount(projectId);
    const keyCount = keyCountData ?? 0;

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
            <article className="relative flex min-h-44 flex-col overflow-hidden rounded-md bg-muted/60 p-5">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background:
                            "radial-gradient(circle 340px at 88% 50%, rgba(139, 92, 246, 0.55) 0%, rgba(139, 92, 246, 0.18) 38%, transparent 68%), radial-gradient(circle 220px at 95% 28%, rgba(59, 130, 246, 0.45) 0%, transparent 70%), radial-gradient(circle 220px at 96% 74%, rgba(249, 115, 22, 0.42) 0%, transparent 70%), radial-gradient(circle 170px at 89% 55%, rgba(250, 204, 21, 0.32) 0%, transparent 70%), radial-gradient(circle 170px at 101% 52%, rgba(239, 68, 68, 0.32) 0%, transparent 70%)",
                    }}
                />
                <div className="relative z-10 mt-auto flex items-end justify-between gap-4 pt-3">
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

            <h2 className="mb-3 mt-8 text-sm font-medium tracking-[-0.02em]">
                Explore our API
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
                {EXPLORE_APIS.map((api) => (
                    <article key={api.title} className="flex flex-col overflow-hidden rounded-md bg-muted/60">
                        <div className="relative aspect-[16/9] w-full bg-foreground/[0.04]">
                            {api.dither ? (
                                <DitherCanvas src={api.image?.src} variant={api.dither} className="absolute inset-0 h-full w-full" />
                            ) : api.image && (
                                <Image
                                    src={api.image}
                                    alt=""
                                    fill
                                    // The cards top out near 440px (a third of the 1360px page).
                                    sizes="(min-width: 1360px) 440px, (min-width: 768px) 33vw, 100vw"
                                    placeholder="blur"
                                    priority
                                    className="object-cover"
                                    style={api.brightness ? { filter: `brightness(${api.brightness})` } : undefined}
                                />
                            )}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-sm font-medium tracking-tight text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
                                    {api.title}
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-1 flex-col p-5">
                            <p className="text-lg font-medium tracking-tight">{api.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{api.description}</p>
                            <div className="mt-auto flex items-center gap-2 pt-5">
                                <Button asChild size="sm" className="h-7 text-xs">
                                    <Link href={api.docsHref}>Get Docs</Link>
                                </Button>
                            </div>
                        </div>
                    </article>
                ))}
            </div>

            {projectId && (
                <GenerateKeyDialog
                    projectId={projectId}
                    open={showGenerateKeyDialog}
                    onOpenChange={setShowGenerateKeyDialog}
                    defaultKeyType="secret"
                    onKeyGenerated={() => {
                        void queryClient.invalidateQueries({
                            queryKey: ["consoleHomeApiKeyCount", projectId],
                        });
                    }}
                />
            )}
        </section>
    );
}
