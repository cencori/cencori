"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";

type Range = "24h" | "7d" | "30d";

const RANGES: Range[] = ["24h", "7d", "30d"];

type Totals = { tokens: number; spend: number; requests: number };

// Org-wide totals for the window, from the same rollup the Usage page uses.
function useUsageTotals(orgSlug: string, range: Range) {
    return useQuery({
        queryKey: ["homeUsageTotals", orgSlug, range],
        queryFn: async (): Promise<Totals> => {
            const response = await fetch(`/api/organizations/${orgSlug}/usage?range=${range}`);
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.error || "Failed to load usage");
            }
            const { rollup } = (await response.json()) as {
                rollup: { total_tokens: number; total_cost: number; total_requests: number } | null;
            };
            return {
                tokens: Number(rollup?.total_tokens ?? 0),
                spend: Number(rollup?.total_cost ?? 0),
                requests: Number(rollup?.total_requests ?? 0),
            };
        },
        staleTime: 60 * 1000,
        placeholderData: (previous) => previous,
    });
}

const compact = (value: number) =>
    new Intl.NumberFormat("en-US", {
        notation: value >= 10_000 ? "compact" : "standard",
        maximumFractionDigits: 1,
    }).format(value);

const METRICS: Array<{ key: keyof Totals; label: string; format: (value: number) => string }> = [
    { key: "tokens", label: "Tokens", format: compact },
    {
        key: "spend",
        label: "Spend",
        format: (value) => formatCurrency(value, "USD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    },
    { key: "requests", label: "Requests", format: compact },
];

export function HomeUsageStats({ orgSlug }: { orgSlug: string }) {
    const [range, setRange] = useState<Range>("7d");
    const { data: totals, isLoading, error } = useUsageTotals(orgSlug, range);
    const periodLabel = range === "24h" ? "Last 24 hours" : range === "30d" ? "Last 30 days" : "Last 7 days";

    return (
        <section className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-4">
                <h2 className="text-sm font-medium tracking-[-0.02em]">Usage</h2>
                <div className="flex items-center gap-0.5 rounded-md bg-muted/60 p-0.5">
                    {RANGES.map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => setRange(option)}
                            aria-pressed={range === option}
                            className={cn(
                                "h-6 rounded-[4px] px-2.5 font-mono text-[10px] font-medium transition-colors",
                                range === option
                                    ? "bg-foreground text-background"
                                    : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {option.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <p className="mb-3 text-xs text-destructive">
                    Couldn&apos;t load usage: {error.message}
                </p>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
                {METRICS.map((metric) => (
                    <article key={metric.key} className="rounded-md bg-muted/60 p-5">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            {metric.label}
                        </p>
                        {/* Same height as the button row on the credits and API
                            key cards, placed above the figure so the number
                            sits at the bottom of the card. */}
                        <div className="mt-4 h-7" aria-hidden="true" />
                        {isLoading && !totals ? (
                            <div className="mt-3 space-y-2">
                                <Skeleton className="h-8 w-28" />
                                <Skeleton className="h-3 w-20" />
                            </div>
                        ) : (
                            <>
                                <p className="mt-3 text-2xl font-medium tracking-tight">
                                    {error && !totals ? "—" : metric.format(totals?.[metric.key] ?? 0)}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">{periodLabel}</p>
                            </>
                        )}
                    </article>
                ))}
            </div>
        </section>
    );
}
