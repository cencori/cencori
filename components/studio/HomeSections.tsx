"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { NotebookIcon } from "@solar-icons/react/bold-duotone/notebook";
import { BellIcon } from "@solar-icons/react/bold-duotone/bell";
import { CardIcon } from "@solar-icons/react/bold-duotone/card";
import { RocketIcon } from "@solar-icons/react/bold-duotone/rocket";
import { BoxIcon } from "@solar-icons/react/bold-duotone/box";
import { ShareIcon } from "@solar-icons/react/bold-duotone/share";
import { QrCodeIcon } from "@solar-icons/react/bold-duotone/qr-code";
import { CalendarAddIcon } from "@solar-icons/react/bold-duotone/calendar-add";
import { CalendarIcon } from "@solar-icons/react/bold-duotone/calendar";
import { EyeIcon } from "@solar-icons/react/bold-duotone/eye";
import { EyeClosedIcon } from "@solar-icons/react/bold-duotone/eye-closed";
import { StudioLink } from "@/components/studio/studio-nav";
import { useStudio } from "@/components/studio/StudioShell";
import { useStudioCopilot } from "@/components/studio/StudioCopilot";
import { taskForStep, useStudioTasks } from "@/components/studio/StudioTasks";
import { formatMoney, type StudioOverview } from "@/components/studio/useStudioOverview";
import { conversationTitle, needsOwnerLabel, shortTime, useInbox, type InboxConversation } from "@/components/studio/useInbox";
import { useSales } from "@/components/studio/useSales";
import { eventWhen, useEvents } from "@/components/studio/useEvents";
import { ConversationAvatar, WhatsAppMark } from "@/components/studio/ConversationAvatar";
import { BriefListen } from "@/components/studio/BriefListen";
import { StudioLinkQr } from "@/components/studio/StudioLinkQr";
import { getMainSiteUrl } from "@/lib/main-site-url";
import { cn } from "@/lib/utils";

/**
 * Home's parts: today's numbers, the chats waiting on the owner, what's up
 * next, the morning brief, quick actions and what's left to set up. Each
 * one hides when it has nothing to say, so a quiet day is a short page.
 */

const card = "overflow-hidden rounded-2xl bg-muted/60";
const needsYou = (conversation: InboxConversation) => !!conversation.needs_owner || conversation.owner_active;

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
    return (
        <section className="mt-8">
            <div className="mb-2.5 flex items-baseline justify-between px-1">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h2>
                {action}
            </div>
            {children}
        </section>
    );
}

const HIDE_BALANCE = "studio-hide-balance";

/**
 * Everything that's come in through the assistant, with an eye to hide it
 * (as banking apps have, for showing the phone to someone). The choice is
 * kept on this phone.
 */
export function TodayCard({ data }: { data: StudioOverview }) {
    const [hidden, setHidden] = useState(false);
    // Read once on the phone, after the page appears (the server can't know it).
    useEffect(() => {
        try {
            if (window.localStorage.getItem(HIDE_BALANCE) === "1") setHidden(true);
        } catch {
            // Private browsing: shown.
        }
    }, []);
    const toggle = () => {
        const next = !hidden;
        setHidden(next);
        try {
            window.localStorage.setItem(HIDE_BALANCE, next ? "1" : "0");
        } catch {
            // Private browsing: it just isn't remembered.
        }
    };
    const amount = data.all_time?.earned.amount ?? data.month.earned?.amount ?? 0;
    return (
        <div className={cn(card, "mt-5 px-5 py-5")}>
            <div className="flex items-center gap-2">
                <p className="text-[13px] text-muted-foreground">All-time balance</p>
                <button type="button" onClick={toggle} aria-label={hidden ? "Show balance" : "Hide balance"} aria-pressed={hidden} className="-m-1.5 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground">
                    {hidden ? <EyeClosedIcon size={15} /> : <EyeIcon size={15} />}
                </button>
            </div>
            <p className="mt-1 text-[34px] font-semibold leading-none tracking-tight">
                {hidden ? <span aria-label="Hidden">*****</span> : formatMoney(amount, data.currency)}
            </p>
        </div>
    );
}

/** Up to three chats waiting on the owner, with why. */
export function NeedsYouSection() {
    const inbox = useInbox(null);
    const waiting = (inbox.data?.conversations ?? []).filter(needsYou);
    if (!waiting.length) return null;
    return (
        <Section title="Needs you" action={waiting.length > 3 ? <StudioLink href="/inbox" className="text-[13px] font-medium text-muted-foreground">See all {waiting.length}</StudioLink> : undefined}>
            <ul className={cn(card, "divide-y divide-border/60")}>
                {waiting.slice(0, 3).map((conversation) => (
                    <li key={conversation.id}>
                        <StudioLink href={`/inbox/${conversation.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-muted">
                            <ConversationAvatar conversation={conversation} className="h-10 w-10" />
                            <span className="min-w-0 flex-1">
                                <span className="flex items-baseline gap-2">
                                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{conversationTitle(conversation)}</span>
                                    <span className="shrink-0 text-xs text-muted-foreground">{shortTime(conversation.updated_at)}</span>
                                </span>
                                <span className="mt-0.5 inline-block rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                                    {conversation.owner_active ? "You're replying" : needsOwnerLabel(conversation.needs_owner!.reason)}
                                </span>
                            </span>
                        </StudioLink>
                    </li>
                ))}
            </ul>
        </Section>
    );
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Today's bookings and the next event in the coming two weeks. */
export function UpNextSection() {
    const sales = useSales();
    const events = useEvents();
    const now = new Date();
    const bookings = (sales.data?.bookings ?? [])
        .filter((booking) => booking.status === "confirmed" && booking.start && !Number.isNaN(Date.parse(booking.start)) && sameDay(new Date(booking.start), now) && Date.parse(booking.start) > now.getTime() - 2 * 3_600_000)
        .sort((a, b) => Date.parse(a.start!) - Date.parse(b.start!))
        .slice(0, 3);
    const event = (events.data?.events ?? [])
        .filter((summary) => summary.event.status === "live" && Date.parse(summary.event.ends_at ?? summary.event.starts_at) + 6 * 3_600_000 > now.getTime() && Date.parse(summary.event.starts_at) - now.getTime() < 14 * 86_400_000)
        .sort((a, b) => Date.parse(a.event.starts_at) - Date.parse(b.event.starts_at))[0];
    if (!bookings.length && !event) return null;
    return (
        <Section title="Up next">
            <ul className={cn(card, "divide-y divide-border/60")}>
                {bookings.map((booking) => (
                    <li key={booking.id}>
                        <StudioLink href="/sales" className="flex items-center gap-3 px-4 py-3 active:bg-muted">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-400/15 text-sky-500 dark:text-sky-400"><CalendarIcon size={20} /></span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[15px] font-semibold">{booking.title}</span>
                                <span className="block text-[13px] text-muted-foreground">{new Date(booking.start!).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true })}</span>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </StudioLink>
                    </li>
                ))}
                {event && (
                    <li>
                        <StudioLink href={`/sales/events/${event.event.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-muted">
                            {event.event.banner_url
                                // eslint-disable-next-line @next/next/no-img-element -- the owner's flyer
                                ? <img src={event.event.banner_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover object-top" />
                                : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-400/15 text-violet-500 dark:text-violet-400"><CalendarIcon size={20} /></span>}
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[15px] font-semibold">{event.event.name}</span>
                                <span className="block truncate text-[13px] text-muted-foreground">{eventWhen(event.event.starts_at)} · {event.sold} sold</span>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </StudioLink>
                    </li>
                )}
            </ul>
        </Section>
    );
}

/** The morning brief: yesterday, and what to do about it. */
export function BriefSection({ brief }: { brief: NonNullable<StudioOverview["brief"]> }) {
    return (
        <Section title="This morning">
            <div className={cn(card, "px-4 py-4")}>
                <p className="text-[17px] font-semibold leading-snug">{brief.headline}</p>
                <ul className="mt-2 space-y-1.5">
                    {brief.points.map((point) => (
                        <li key={point} className="flex gap-2 text-[14px] leading-5"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />{point}</li>
                    ))}
                </ul>
                <BriefListen at={brief.at} />
            </div>
        </Section>
    );
}

/** Things owners do often, one tap each. */
export function QuickActions({ data }: { data: StudioOverview }) {
    const tasks = useStudioTasks();
    const { organization } = useStudio();
    const [qr, setQr] = useState(false);
    const link = data.share_token ? `${new URL(getMainSiteUrl("/")).origin}/talk/${data.share_token}` : null;
    const share = async () => {
        if (!link) return;
        try {
            if (navigator.share) await navigator.share({ title: data.assistant?.name ?? organization.name, url: link });
            else await navigator.clipboard.writeText(link);
        } catch {
            // Dismissed the share sheet.
        }
    };
    const actions = [
        ...(link ? [
            { label: "Share link", icon: ShareIcon, tone: "bg-sky-400/15 text-sky-500 dark:text-sky-400", onClick: () => void share() },
            { label: "QR code", icon: QrCodeIcon, tone: "bg-foreground/10 text-foreground", onClick: () => setQr(true) },
        ] : []),
        { label: "New event", icon: CalendarAddIcon, tone: "bg-violet-400/15 text-violet-500 dark:text-violet-400", onClick: () => tasks.open("event") },
        { label: "Add products", icon: BoxIcon, tone: "bg-orange-400/15 text-orange-500 dark:text-orange-400", onClick: () => tasks.open("products") },
    ];
    return (
        <section className="mt-8">
            <div className="grid grid-cols-4 gap-2">
                {actions.map((action) => (
                    <button key={action.label} type="button" onClick={action.onClick} className="flex flex-col items-center gap-1.5">
                        <span className={cn("flex h-14 w-14 items-center justify-center rounded-full", action.tone)}><action.icon size={24} /></span>
                        <span className="text-[12px] font-medium">{action.label}</span>
                    </button>
                ))}
            </div>
            {link && <StudioLinkQr url={link} name={data.assistant?.name ?? organization.name} open={qr} onOpenChange={setQr} />}
        </section>
    );
}

/** A setup step's icon, by what it's about. */
function stepIcon(step: string) {
    const text = step.toLowerCase();
    if (text.includes("whatsapp")) return { icon: <WhatsAppMark className="h-5 w-5" />, tone: "bg-[#25D366]/15 text-[#25D366]" };
    if (text.includes("knowledge")) return { icon: <NotebookIcon size={20} />, tone: "bg-violet-400/15 text-violet-500 dark:text-violet-400" };
    if (text.includes("alert")) return { icon: <BellIcon size={20} />, tone: "bg-amber-400/15 text-amber-500 dark:text-amber-400" };
    if (text.includes("payment")) return { icon: <CardIcon size={20} />, tone: "bg-sky-400/15 text-sky-500 dark:text-sky-400" };
    if (text.includes("product")) return { icon: <BoxIcon size={20} />, tone: "bg-orange-400/15 text-orange-500 dark:text-orange-400" };
    return { icon: <RocketIcon size={20} />, tone: "bg-emerald-400/15 text-emerald-500 dark:text-emerald-400" };
}

/** What's left to set up, each one done in a sheet (or with Copilot). */
export function SetupSection({ steps }: { steps: string[] }) {
    const tasks = useStudioTasks();
    const { ask } = useStudioCopilot();
    if (!steps.length) return null;
    return (
        <Section title="Finish setting up" action={<span className="text-[13px] text-muted-foreground">{steps.length} left</span>}>
            <ul className={cn(card, "divide-y divide-border/60")}>
                {steps.map((step) => {
                    const { icon, tone } = stepIcon(step);
                    return (
                        <li key={step}>
                            <button type="button" onClick={() => {
                                // Done right here in a sheet; Copilot helps with anything else.
                                const task = taskForStep(step);
                                if (task) tasks.open(task);
                                else ask(`Help me ${step.charAt(0).toLowerCase()}${step.slice(1)}`);
                            }} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-muted">
                                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", tone)}>{icon}</span>
                                <span className="min-w-0 flex-1 text-[15px] font-medium">{step}</span>
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                            </button>
                        </li>
                    );
                })}
            </ul>
        </Section>
    );
}
