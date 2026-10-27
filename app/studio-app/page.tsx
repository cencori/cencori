"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { UserRoundedIcon } from "@solar-icons/react/bold-duotone/user-rounded";
import { useStudio } from "@/components/studio/StudioShell";
import { useStudioCopilot } from "@/components/studio/StudioCopilot";
import { formatMoney, joinWords, liveChannels, setupSteps, useStudioOverview } from "@/components/studio/useStudioOverview";
import { shortTime, useInbox } from "@/components/studio/useInbox";
import { StudioNotificationsCard } from "@/components/studio/StudioNotifications";
import { StudioProfile } from "@/components/studio/StudioProfile";
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
    // Chats waiting on the owner: the assistant handed them over, or the owner is mid-reply.
    const inbox = useInbox(null);
    const waiting = (inbox.data?.conversations ?? []).filter((conversation) => conversation.needs_owner || conversation.owner_active);
    const data = overview.data;
    const live = liveChannels(data?.assistant ?? null);
    const steps = setupSteps(data?.assistant?.still_to_do ?? []);
    const router = useRouter();

    // Opened from the home screen with nothing set up yet: setup starts right away.
    useEffect(() => {
        if (agents.length > 0) return;
        const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
        if (installed) router.replace("/setup");
    }, [agents.length, router]);

    return (
        // Nothing set up yet: the page fills the space above the ask bar so the
        // setup card can sit in the middle of it.
        <div className={agents.length === 0 ? "flex min-h-[calc(100svh-11.25rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col" : undefined}>
            <div className="flex items-center gap-3">
                <StudioProfile className="size-10" />
                <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{organization.name}</p>
                    <h1 className="text-xl font-semibold leading-tight tracking-tight">
                        {greeting()}{user.firstName ? `, ${user.firstName}` : ""}
                    </h1>
                </div>
            </div>

            {agents.length === 0 ? (
                <div className="my-auto flex min-h-[26rem] flex-col items-center justify-center rounded-3xl bg-foreground p-6 text-center text-background">
                    <UserRoundedIcon size={40} className="mb-3" />
                    <p className="text-lg font-semibold">Set up your assistant</p>
                    <p className="mt-1 text-sm leading-6 opacity-80">A few questions about your business, and it starts answering customers on your link and WhatsApp.</p>
                    <Link href="/setup" className="mt-4 inline-flex h-11 items-center rounded-full bg-background px-5 text-sm font-semibold text-foreground">Start</Link>
                </div>
            ) : overview.isLoading ? (
                <div className="mt-5 space-y-3">
                    <Skeleton className="h-5 w-56" />
                    <Skeleton className="h-36 w-full rounded-3xl" />
                    <Skeleton className="h-24 w-full rounded-2xl" />
                </div>
            ) : overview.isError ? (
                <p className="mt-6 text-sm text-destructive">{overview.error instanceof Error ? overview.error.message : "Couldn't load your business."}</p>
            ) : (
                <>
                    <Link href="/assistant" className="mt-4 flex items-center gap-2 text-[13px] text-muted-foreground">
                        <span className={live.length ? "h-2 w-2 rounded-full bg-emerald-500" : "h-2 w-2 rounded-full bg-amber-500"} />
                        {live.length
                            ? <span><span className="font-medium text-foreground">Live</span> on {joinWords(live)}</span>
                            : <span><span className="font-medium text-foreground">Not live yet.</span> Finish setting up below.</span>}
                    </Link>

                    <StudioNotificationsCard />

                    {waiting.length > 0 && (
                        <section className="mt-4">
                            <div className="mb-2 flex items-baseline justify-between">
                                <h2 className="text-[15px] font-semibold">Needs you</h2>
                                <Link href="/inbox" className="text-[13px] text-muted-foreground">See all</Link>
                            </div>
                            <ul className="overflow-hidden rounded-2xl border border-orange-200 bg-orange-50/60 dark:border-orange-500/20 dark:bg-orange-500/5">
                                {waiting.slice(0, 3).map((conversation) => (
                                    <li key={conversation.id} className="border-b border-orange-200 last:border-0 dark:border-orange-500/20">
                                        <Link href={`/inbox/${conversation.id}`} className="flex gap-3 px-4 py-3">
                                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-600" />
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-baseline justify-between gap-2">
                                                    <span className="truncate text-[15px] font-semibold">{conversation.name}</span>
                                                    <span className="shrink-0 text-xs text-muted-foreground">{shortTime(conversation.needs_owner?.at ?? conversation.updated_at)}</span>
                                                </span>
                                                <span className="mt-0.5 block line-clamp-2 text-[13px] leading-5 text-foreground/80">
                                                    {conversation.owner_active ? "You're replying in this chat." : conversation.needs_owner?.reason}
                                                </span>
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    <div className="mt-4 rounded-3xl bg-foreground p-5 text-background">
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
