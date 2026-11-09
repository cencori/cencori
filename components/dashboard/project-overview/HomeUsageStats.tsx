"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { useRangeChoice } from "@/components/sessions/SessionFilters";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { CurrencyToggle } from "@/components/dashboard/CurrencyToggle";

type Range = "24h" | "7d" | "30d" | "90d" | "all";

const RANGES: Array<{ value: Range; label: string; period: string }> = [
    { value: "24h", label: "24 hours", period: "Last 24 hours" },
    { value: "7d", label: "7 days", period: "Last 7 days" },
    { value: "30d", label: "30 days", period: "Last 30 days" },
    { value: "90d", label: "90 days", period: "Last 90 days" },
    { value: "all", label: "All time", period: "All time" },
];

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
                rollup: { total_tokens: number; total_cost: number; total_spend?: number; total_requests: number } | null;
            };
            return {
                tokens: Number(rollup?.total_tokens ?? 0),
                // Total AI spend: Cencori's charges plus the provider cost of
                // calls on the customer's own keys. total_cost (charges only)
                // until the total_spend migration is applied.
                spend: Number(rollup?.total_spend ?? rollup?.total_cost ?? 0),
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

const METRICS: Array<{ key: keyof Totals; label: string; money?: boolean }> = [
    { key: "tokens", label: "Tokens" },
    { key: "spend", label: "Spend", money: true },
    { key: "requests", label: "Requests" },
];

export function HomeUsageStats({ orgSlug }: { orgSlug: string }) {
    const [range, setRange] = useState<Range>("7d");
    const { data: totals, isLoading, error } = useUsageTotals(orgSlug, range);
    const { formatMoney } = useDisplayCurrency();
    const periodLabel = RANGES.find((option) => option.value === range)?.period ?? "Last 7 days";
    // History follows the plan (Free 7 days, Pro 30, Enterprise all): a longer
    // range shows a lock; picking it opens the upgrade (Pro) or /contact (Enterprise).
    const rangeChoice = useRangeChoice();
    const chooseRange = (value: Range) => rangeChoice(value, () => setRange(value)).onClick();

    return (
        <section className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-4">
                <h2 className="text-sm font-medium tracking-[-0.02em]">Usage</h2>
                <div className="flex items-center gap-2">
                <CurrencyToggle />
                <Select value={range} onValueChange={(value) => chooseRange(value as Range)}>
                    <SelectTrigger
                        aria-label="Time range"
                        className="h-8 w-auto gap-1.5 rounded-full border-0 bg-muted/60 pl-3.5 pr-2.5 font-inter text-xs font-medium shadow-none"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                        {RANGES.map((option) => (
                            <SelectItem key={option.value} value={option.value} className="font-inter text-xs">
                                <span className="flex w-full items-center gap-2">
                                    {option.label}
                                    {rangeChoice(option.value, () => {}).lock && (
                                        <Lock
                                            className="ml-auto h-3 w-3 text-muted-foreground"
                                            aria-label={rangeChoice(option.value, () => {}).lock === "pro" ? "Pro" : "Enterprise"}
                                        />
                                    )}
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
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
                                    {error && !totals ? "—" : (metric.money ? formatMoney : compact)(totals?.[metric.key] ?? 0)}
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
