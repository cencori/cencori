"use client";

import { useEffect } from "react";
import { StudioLoadError } from "@/components/studio/studio-data";
import { StudioLink } from "@/components/studio/studio-nav";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { UserRoundedIcon } from "@solar-icons/react/bold-duotone/user-rounded";
import { useStudio } from "@/components/studio/StudioShell";
import { useStudioCopilot } from "@/components/studio/StudioCopilot";
import { formatMoney, setupSteps, useStudioOverview } from "@/components/studio/useStudioOverview";
import { StudioNotificationsCard } from "@/components/studio/StudioNotifications";
import { StudioProfile } from "@/components/studio/StudioProfile";
import { StudioNotificationBell } from "@/components/studio/StudioNotificationBell";
import { Skeleton } from "@/components/ui/skeleton";

function greeting(): string {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/** Home: today at a glance. */
export default function StudioHomePage() {
    const { user, organization, agents } = useStudio();
    const { ask } = useStudioCopilot();
    const overview = useStudioOverview();
    const data = overview.data;
    const steps = setupSteps(data?.assistant?.still_to_do ?? []);
    const router = useRouter();

    // Opened from the home screen with nothing set up yet: setup starts right away.
    useEffect(() => {
        if (agents.length > 0) return;
        const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
        if (installed) router.replace("/setup");
    }, [agents.length, router]);

    return (
        // Nothing set up yet: the page fills the space above the tabs so the
        // setup card can sit in the middle of it.
        <div className={agents.length === 0 ? "flex min-h-[calc(100svh-7.25rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col" : undefined}>
            <div className="flex items-center gap-3">
                <StudioProfile className="size-10" />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-muted-foreground">{organization.name}</p>
                    <h1 className="text-xl font-semibold leading-tight tracking-tight">
                        {greeting()}{user.firstName ? `, ${user.firstName}` : ""}
                    </h1>
                </div>
                {agents.length > 0 && <StudioNotificationBell className="size-10" />}
            </div>

            {agents.length === 0 ? (
                <div className="my-auto flex min-h-[26rem] flex-col items-center justify-center rounded-3xl bg-foreground p-6 text-center text-background">
                    <UserRoundedIcon size={40} className="mb-3" />
                    <p className="text-lg font-semibold">Set up your assistant</p>
                    <p className="mt-1 text-sm leading-6 opacity-80">A few questions about your business, and it starts answering customers on your link and WhatsApp.</p>
                    <StudioLink href="/setup" className="mt-4 inline-flex h-11 items-center rounded-full bg-background px-5 text-sm font-semibold text-foreground">Start</StudioLink>
                </div>
            ) : overview.isLoading ? (
                <div className="mt-5 space-y-3">
                    <Skeleton className="h-5 w-56" />
                    <Skeleton className="h-36 w-full rounded-3xl" />
                    <Skeleton className="h-24 w-full rounded-2xl" />
                </div>
            ) : !overview.data ? (
                <StudioLoadError error={overview.error} fallback="Couldn't load your business." onRetry={() => void overview.refetch()} />
            ) : (
                <>
                    <StudioNotificationsCard />

                    <div className="mt-5 rounded-2xl bg-foreground p-5 text-background">
                        {data?.payments_connected && data.today.earned ? (
                            <>
                                <p className="text-[13px] opacity-70">Earned today</p>
                                <p className="mt-1 text-[34px] font-semibold leading-none tracking-tight">{formatMoney(data.today.earned.amount, data.currency)}</p>
                                <p className="mt-3 flex gap-4 text-[13px] opacity-80">
                                    <span>{data.today.earned.count} paid</span>
                                    <span>{data.today.chats} {data.today.chats === 1 ? "chat" : "chats"}</span>
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-[13px] opacity-70">Chats today</p>
                                <p className="mt-1 text-[34px] font-semibold leading-none tracking-tight">{data?.today.chats ?? 0}</p>
                                <p className="mt-3 text-[13px] opacity-80">{data?.month.chats ?? 0} this month</p>
                            </>
                        )}
                    </div>

                    {steps.length > 0 && (
                        <section className="mt-6">
                            <h2 className="mb-2 text-[15px] font-semibold">Finish setting up</h2>
                            <ul className="overflow-hidden rounded-2xl border border-border/60">
                                {steps.map((step) => (
                                    <li key={step} className="border-b border-border/60 last:border-0">
                                        <button type="button" onClick={() => ask(`Help me ${step.charAt(0).toLowerCase()}${step.slice(1)}`)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                                            <span className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/40" />
                                            <span className="min-w-0 flex-1 text-[15px]">{step}</span>
                                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {data?.plan && (
                        <section className="mt-6 rounded-2xl border border-border/60 px-4 py-4">
                            <div className="flex items-baseline justify-between">
                                <h2 className="text-[15px] font-semibold">This month</h2>
                                <span className="text-xs text-muted-foreground">{data.plan.name}</span>
                            </div>
                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                                <span className="block h-full rounded-full bg-foreground" style={{ width: `${Math.min(100, Math.round((data.plan.used / Math.max(1, data.plan.conversations)) * 100))}%` }} />
                            </div>
                            <p className="mt-2 text-[13px] text-muted-foreground">
                                {data.plan.active
                                    ? `${data.plan.used} of ${data.plan.conversations} chats used`
                                    : "Your plan has ended. Your assistant isn't starting new chats."}
                            </p>
                        </section>
                    )}
                </>
            )}
        </div>
    );
}
