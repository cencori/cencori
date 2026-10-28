"use client";

import { useState } from "react";
import { StudioLoadError, studioFetch } from "@/components/studio/studio-data";
import { useQuery } from "@tanstack/react-query";
import { useStudio } from "@/components/studio/StudioShell";
import { useStudioTasks } from "@/components/studio/StudioTasks";
import { formatMoney } from "@/components/studio/useStudioOverview";
import { GetPaidCard, TransfersToConfirm, type BankAccount, type TransferToConfirm } from "@/components/studio/StudioTransfers";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getMainSiteUrl } from "@/lib/main-site-url";
import { ChevronRight } from "lucide-react";
import type { MoneyPeriod, MoneySummary } from "@/lib/studio/money";

type Money = MoneySummary & { payments: { provider: string; mode: string } | null; bank_account: BankAccount | null; bank_accounts?: BankAccount[]; transfers_to_confirm: TransferToConfirm[] };

const PERIODS: Array<{ id: MoneyPeriod; label: string; caption: string; previous: string }> = [
    { id: "week", label: "Week", caption: "Last 7 days", previous: "the 7 days before" },
    { id: "month", label: "Month", caption: "This month so far", previous: "the same days last month" },
    { id: "year", label: "Year", caption: "This year so far", previous: "the same time last year" },
];

/** What came in through the assistant: totals, a bar chart, where it came from and what sold. */
export default function StudioMoneyPage() {
    const { project } = useStudio();
    const tasks = useStudioTasks();
    const [period, setPeriod] = useState<MoneyPeriod>("week");
    const meta = PERIODS.find((p) => p.id === period)!;
    const money = useQuery({
        queryKey: ["studio-money", project.id, period],
        queryFn: async (): Promise<Money> => {
            const response = await studioFetch(`/api/studio/money?project_id=${project.id}&period=${period}`, { cache: "no-store" });
            const body = await response.json().catch(() => null);
            if (!response.ok) throw new Error((body as { error?: string } | null)?.error ?? "Couldn't load your money.");
            return body as Money;
        },
        refetchOnWindowFocus: true,
    });
    const data = money.data;
    const max = Math.max(1, ...(data?.bars ?? []).map((bar) => bar.amount));
    const change = data ? data.total - data.previous : 0;

    return (
        <div>
            {/* The title and switcher stay put while the page scrolls under them. */}
            <div className="sticky top-0 z-30 -mx-4 -mt-[calc(1.25rem+env(safe-area-inset-top))] bg-background px-4 pb-3 pt-[calc(1.25rem+env(safe-area-inset-top))] lg:-mx-10 lg:-mt-10 lg:px-10 lg:pt-10">
                <h1 className="text-[26px] font-semibold leading-tight tracking-tight">Money</h1>
                <div role="tablist" aria-label="Period" className="mt-4 grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
                    {PERIODS.map((item) => (
                        <button key={item.id} type="button" role="tab" aria-selected={period === item.id} onClick={() => setPeriod(item.id)} className={cn("h-9 rounded-full text-sm font-medium", period === item.id ? "bg-background text-foreground" : "text-muted-foreground")}>
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {money.isPending && !money.isError ? (
                <div className="mt-6 space-y-3"><Skeleton className="h-10 w-48" /><Skeleton className="h-32 w-full rounded-2xl" /><Skeleton className="h-28 w-full rounded-2xl" /></div>
            ) : !data ? (
                <StudioLoadError error={money.error} fallback="Couldn't load your money." onRetry={() => void money.refetch()} />
            ) : (
                <>
                    <p className="mt-5 text-[13px] text-muted-foreground">{meta.caption}</p>
                    <p className="mt-1 text-[38px] font-semibold leading-none tracking-tight">{formatMoney(data.total, data.currency)}</p>
                    {(data.total > 0 || data.previous > 0) && (
                        <p className={cn("mt-2 text-[13px] font-medium", change >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
                            {change === 0 ? `Same as ${meta.previous}` : `${change > 0 ? "Up" : "Down"} ${formatMoney(Math.abs(change), data.currency)} on ${meta.previous}`}
                        </p>
                    )}

                    <TransfersToConfirm transfers={data.transfers_to_confirm} />

                    <div role="img" aria-label={`${meta.caption}: ${data.bars.map((bar) => `${bar.label} ${formatMoney(bar.amount, data.currency)}`).join(", ")}`} className="mt-5 flex h-32 items-end gap-2">
                        {data.bars.map((bar, index) => (
                            <div key={`${bar.label}-${index}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                                <span
                                    className={cn("w-full rounded-md", bar.amount > 0 ? (bar.current ? "bg-foreground" : "bg-emerald-600/80") : "bg-muted")}
                                    style={{ height: bar.amount > 0 ? `${Math.max(6, Math.round((bar.amount / max) * 100))}%` : "4px" }}
                                />
                                <span className={cn("text-[11px]", bar.current ? "font-semibold text-foreground" : "text-muted-foreground")}>{bar.label}</span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 divide-y divide-border/60 overflow-hidden rounded-2xl bg-muted/60 text-[15px]">
                        <div className="flex justify-between px-4 py-3"><span>Paid by link</span><span className="font-semibold">{formatMoney(data.by_link, data.currency)}</span></div>
                        {(data.by_transfer > 0 || data.bank_account) && <div className="flex justify-between px-4 py-3"><span>By transfer, confirmed</span><span className="font-semibold">{formatMoney(data.by_transfer, data.currency)}</span></div>}
                        <div className="flex justify-between px-4 py-3"><span>{data.bank_account ? "Cash, marked paid" : "Cash and transfer, marked paid"}</span><span className="font-semibold">{formatMoney(data.marked_paid, data.currency)}</span></div>
                        {data.to_collect > 0 && <div className="flex justify-between px-4 py-3 text-amber-800 dark:text-amber-400"><span>Still to collect</span><span className="font-semibold">{formatMoney(data.to_collect, data.currency)}</span></div>}
                    </div>

                    {data.top_items.length > 0 && (
                        <section className="mt-6">
                            <h2 className="mb-2 text-[15px] font-semibold">Best sellers</h2>
                            <ul className="overflow-hidden rounded-2xl border border-border/60">
                                {data.top_items.map((item) => (
                                    <li key={item.name} className="flex items-center justify-between border-b border-border/60 px-4 py-3 last:border-0">
                                        <span className="min-w-0 truncate text-[15px]">{item.name}<span className="ml-2 text-xs text-muted-foreground">× {item.quantity}</span></span>
                                        <span className="shrink-0 text-[15px] font-semibold">{formatMoney(item.amount, data.currency)}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    <GetPaidCard accounts={data.bank_accounts ?? (data.bank_account ? [data.bank_account] : [])} payments={data.payments} onConnectProvider={() => tasks.open("payments")} />
                    <a href={getMainSiteUrl("/docs/agents/payments-and-products#your-money-in-studio")} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-1 px-1 text-[13px] font-medium text-muted-foreground">
                        How we handle your money<ChevronRight className="h-3.5 w-3.5" />
                    </a>
                </>
            )}
        </div>
    );
}
