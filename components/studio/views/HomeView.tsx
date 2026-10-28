"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { StudioLoadError } from "@/components/studio/studio-data";
import { StudioLink } from "@/components/studio/studio-nav";
import { useRouter } from "next/navigation";
import { UserRoundedIcon } from "@solar-icons/react/bold-duotone/user-rounded";
import { useStudio } from "@/components/studio/StudioShell";
import { useStudioTasks } from "@/components/studio/StudioTasks";
import { setupSteps, useStudioOverview } from "@/components/studio/useStudioOverview";
import { StudioProfile } from "@/components/studio/StudioProfile";
import { StudioNotificationBell } from "@/components/studio/StudioNotificationBell";
import { BriefSection, NeedsYouSection, QuickActions, SetupSection, TodayCard, UpNextSection } from "@/components/studio/HomeSections";
import { Skeleton } from "@/components/ui/skeleton";

function greeting(): string {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/** Home: today at a glance. */
export default function StudioHomePage() {
    const { user, organization, agents } = useStudio();
    const tasks = useStudioTasks();
    const overview = useStudioOverview();
    const data = overview.data;
    const steps = setupSteps(data?.assistant?.still_to_do ?? []);
    const router = useRouter();
    // Set up once an assistant has been published; one that setup only started
    // (it stopped, or they left part way) still means setup isn't finished.
    const setUp = agents.some((agent) => agent.published);
    const started = agents.length > 0;

    // Opened from the home screen with nothing set up yet: setup starts right away.
    useEffect(() => {
        if (setUp) return;
        const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
        if (installed) router.replace("/setup");
    }, [setUp, router]);

    return (
        // Nothing set up yet: the page fills the space above the tabs so the
        // setup card can sit in the middle of it.
        <div className={!setUp ? "flex min-h-[calc(100svh-7.25rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col lg:min-h-[calc(100svh-5.5rem)]" : undefined}>
            <div className="flex items-center gap-3">
                <StudioProfile className="size-10 lg:hidden" />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-muted-foreground">{organization.name}</p>
                    <h1 className="text-xl font-semibold leading-tight tracking-tight">
                        {greeting()}{user.firstName ? `, ${user.firstName}` : ""}
                    </h1>
                </div>
                {setUp && <StudioNotificationBell className="size-10" />}
            </div>

            {/* A plan's last days, its grace days, its extras, or a plan that has stopped: say so, with the way to pay. */}
            {setUp && data?.plan && (() => {
                const plan = data.plan;
                const daysLeft = plan.period_end ? Math.ceil((Date.parse(plan.period_end) - Date.now()) / 86_400_000) : null;
                const graceDays = plan.grace_end ? Math.max(1, Math.ceil((Date.parse(plan.grace_end) - Date.now()) / 86_400_000)) : null;
                const name = plan.name === "Free trial" ? "free trial" : `${plan.name} plan`;
                const ending = plan.active && !plan.in_grace && daysLeft !== null && daysLeft <= 3;
                const overChats = plan.active && plan.used >= plan.conversations;
                if (plan.active && !plan.in_grace && !ending && !overChats) return null;
                const [title, body] = !plan.active
                    ? ["Your assistant has stopped", "Choose a plan to switch it back on."]
                    : plan.in_grace
                        ? [`Your ${name} has ended`, `Still answering for ${graceDays} more day${graceDays === 1 ? "" : "s"}.`]
                        : overChats
                            ? ["All your chats used", `${Math.max(0, plan.capacity - plan.used)} extra left.`]
                            : [daysLeft! <= 1 ? `Your ${name} ends today` : `Your ${name} ends in ${daysLeft} days`, "Renew to keep your assistant answering."];
                return (
                    <div className={cn("mt-5 rounded-2xl px-4 py-3.5", plan.active ? "bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200" : "bg-destructive/10 text-destructive")}>
                        <p className="text-[15px] font-semibold">{title}</p>
                        <p className="mt-0.5 text-[13px] leading-5 opacity-90">{body}</p>
                        <button type="button" onClick={() => tasks.open("plans")} className="mt-3 h-10 rounded-full bg-foreground px-5 text-sm font-semibold text-background">{plan.name === "Free trial" || !plan.active ? "Choose a plan" : "Renew"}</button>
                    </div>
                );
            })()}

            {!setUp ? (
                <div className="my-auto flex min-h-[26rem] flex-col items-center justify-center rounded-3xl bg-foreground p-6 text-center text-background">
                    <UserRoundedIcon size={40} className="mb-3" />
                    <p className="text-lg font-semibold">{started ? "Finish setting up your assistant" : "Set up your assistant"}</p>
                    <p className="mt-1 text-sm leading-6 opacity-80">
                        {started
                            ? "You're part of the way there. Pick up where you left off, and it starts answering customers on your link and WhatsApp."
                            : "A few questions about your business, and it starts answering customers on your link and WhatsApp."}
                    </p>
                    <StudioLink href="/setup" className="mt-4 inline-flex h-11 items-center rounded-full bg-background px-5 text-sm font-semibold text-foreground">{started ? "Continue" : "Start"}</StudioLink>
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

                    <TodayCard data={data!} />
                    <NeedsYouSection />
                    <UpNextSection />
                    {data?.brief && <BriefSection brief={data.brief} />}
                    <QuickActions data={data!} />
                    <SetupSection steps={steps} />
                </>
            )}
        </div>
    );
}
