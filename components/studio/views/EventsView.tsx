"use client";

import { useEffect, useRef, useState } from "react";
import { Drawer } from "vaul";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Share2, X } from "lucide-react";
import { CalendarIcon } from "@solar-icons/react/bold-duotone/calendar";
import { CalendarIcon as CalendarLinearIcon } from "@solar-icons/react/linear/calendar";
import { MapPointIcon } from "@solar-icons/react/linear/map-point";
import { useStudio } from "@/components/studio/StudioShell";
import { StudioLoadError, studioFetch } from "@/components/studio/studio-data";
import { StudioLink } from "@/components/studio/studio-nav";
import { useStudioTasks } from "@/components/studio/StudioTasks";
import { StudioEmptyCard } from "@/components/studio/StudioEmptyCard";
import { SHEET_AS_PAGE, SHEET_OVERLAY_PHONE_ONLY, SheetPageBack } from "@/components/studio/studio-sheet";
import { formatMoney } from "@/components/studio/useStudioOverview";
import { eventLink, eventWhen, useEvent, useEvents, type StudioEventSummary, type StudioGuest } from "@/components/studio/useEvents";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** Guests shown at a time on an event's page. */
const GUESTS_PER_PAGE = 10;

const past = (summary: StudioEventSummary) => Date.parse(summary.event.ends_at ?? summary.event.starts_at) < Date.now() - 6 * 3_600_000;

/** Sales → Events: every event, the next ones first, and a way to make one. */
export function EventsList() {
    const events = useEvents();
    if (events.isLoading) return <div className="mt-4 space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>;
    if (!events.data) return <StudioLoadError error={events.error} fallback="Couldn't load your events." onRetry={() => void events.refetch()} />;
    const list = [...events.data.events].sort((a, b) => Number(past(a)) - Number(past(b)) || (past(a) ? Date.parse(b.event.starts_at) - Date.parse(a.event.starts_at) : Date.parse(a.event.starts_at) - Date.parse(b.event.starts_at)));
    if (!list.length) {
        return (
            <StudioEmptyCard icon={CalendarIcon} title="No events yet" description="Sell tickets for a party, a show or a dinner. Guests pay, get a QR ticket, and you check them in at the door." />
        );
    }
    return (
        <>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {list.map((summary) => <li key={summary.event.id}><EventPoster summary={summary} /></li>)}
            </ul>
        </>
    );
}

/**
 * An event as a poster: the flyer is the card (it's what people know the event
 * by), cropped square from the top (where a flyer's headline is), with the
 * name and date under it; the whole flyer shows on the event's page. Dark in both themes, like the flyers.
 * Without a flyer, the name set large on a dark gradient stands in.
 */
function EventPoster({ summary }: { summary: StudioEventSummary }) {
    const { event } = summary;
    return (
        <StudioLink href={`/sales/events/${event.id}`} className={cn("block overflow-hidden rounded-2xl bg-[#262626] text-white transition active:scale-[0.98]", past(summary) && "opacity-60")}>
            <div className="relative aspect-square w-full overflow-hidden bg-[#1a1a1a]">
                {event.banner_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- the owner's upload; size unknown
                    <img src={event.banner_url} alt="" className="h-full w-full object-cover object-top" />
                ) : (
                    <div className="flex h-full w-full items-end bg-[radial-gradient(circle_at_75%_20%,#4b2a7a_0,transparent_45%),linear-gradient(160deg,#2b1d4a,#121212_70%)] p-3">
                        <p className="line-clamp-4 text-[20px] font-semibold uppercase leading-[0.95] tracking-tight">{event.name}</p>
                    </div>
                )}
            </div>
            <div className="px-3 pb-3 pt-2.5">
                <p className="truncate text-[14px] font-medium leading-tight">{event.name}</p>
                <p className="mt-0.5 truncate text-[12px] text-white/55">{eventWhen(event.starts_at)}</p>
            </div>
        </StudioLink>
    );
}

/** One event: how it's selling, the link to share, the guest list, and check-in at the door. */
export default function StudioEventPage({ id }: { id: string }) {
    const { project } = useStudio();
    const tasks = useStudioTasks();
    const query = useEvent(id);
    const queryClient = useQueryClient();
    const [checking, setChecking] = useState(false);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const summary = query.data?.event;
    const guests = query.data?.guests ?? [];

    const share = async () => {
        if (!summary) return;
        const url = eventLink(summary.event.slug);
        try {
            if (navigator.share) await navigator.share({ title: summary.event.name, url });
            else await navigator.clipboard.writeText(url);
        } catch {
            // Dismissed the share sheet.
        }
    };
    const setStatus = async (status: "live" | "closed") => {
        setBusy(true);
        setError(null);
        try {
            const response = await studioFetch("/api/studio/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: project.id, action: "update", event_id: id, status }) });
            if (!response.ok) throw new Error(((await response.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't change it.");
            await Promise.all([queryClient.invalidateQueries({ queryKey: ["studio-event", project.id, id] }), queryClient.invalidateQueries({ queryKey: ["studio-events", project.id] })]);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't change it.");
        } finally {
            setBusy(false);
        }
    };

    const shown = search.trim()
        ? guests.filter((guest) => `${guest.buyer_name} ${guest.code} ${guest.buyer_phone ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()))
        : guests;
    const pages = Math.max(1, Math.ceil(shown.length / GUESTS_PER_PAGE));
    // A refetch can shrink the list under the page you're on.
    const current = Math.min(page, pages - 1);

    return (
        <div>
            {/* Back and Edit stay put while the page scrolls under them (as the Sales title does). */}
            <div className="sticky top-0 z-30 -mx-4 -mt-[calc(1.25rem+env(safe-area-inset-top))] flex items-center justify-between bg-background px-4 pb-2 pt-[calc(1.25rem+env(safe-area-inset-top))] lg:-mx-10 lg:-mt-10 lg:px-10 lg:pt-10">
                <StudioLink href="/sales?view=events" aria-label="Back to Events" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full"><ChevronLeft className="h-5 w-5" /></StudioLink>
                {summary && <button type="button" onClick={() => tasks.open("event", { eventId: id })} className="h-9 rounded-full border border-border/60 px-4 text-[13px] font-semibold">Edit</button>}
            </div>
            {query.isLoading ? (
                <div className="mt-3 space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="h-28 w-full rounded-2xl" /><Skeleton className="h-40 w-full rounded-2xl" /></div>
            ) : !summary ? (
                <StudioLoadError error={query.error} fallback="Couldn't load this event." onRetry={() => void query.refetch()} />
            ) : (
                <>
                    {summary.event.banner_url && (
                        // eslint-disable-next-line @next/next/no-img-element -- the owner's upload; size unknown
                        <img src={summary.event.banner_url} alt="" className="mt-2 max-h-72 w-full rounded-2xl object-cover object-top" />
                    )}
                    <h1 className="mt-4 text-[26px] font-semibold leading-tight tracking-tight">{summary.event.name}</h1>
                    <ul className="mt-4 space-y-2.5 text-[15px] leading-6">
                        {summary.event.venue && (
                            <li className="flex gap-3"><MapPointIcon size={20} className="mt-0.5 shrink-0 text-muted-foreground" /><span>{summary.event.venue}</span></li>
                        )}
                        <li className="flex gap-3"><CalendarLinearIcon size={20} className="mt-0.5 shrink-0 text-muted-foreground" /><span>{eventWhen(summary.event.starts_at)}</span></li>
                    </ul>

                    <div className="mt-6 grid grid-cols-3 divide-x divide-border/60 overflow-hidden rounded-2xl bg-muted/60">
                        {[
                            { label: "Sold", value: String(summary.sold), of: summary.capacity ? `/ ${summary.capacity}` : null },
                            { label: "Earned", value: shortMoney(summary.earned, summary.event.currency), of: null },
                            { label: "Checked in", value: String(summary.checked_in), of: summary.sold ? `/ ${summary.sold}` : null },
                        ].map((stat) => (
                            <div key={stat.label} className="px-4 py-3.5">
                                <p className="text-[12px] text-muted-foreground">{stat.label}</p>
                                <p className="mt-1 truncate text-[20px] font-semibold leading-none tracking-tight">{stat.value}{stat.of && <span className="text-[13px] font-normal text-muted-foreground"> {stat.of}</span>}</p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setChecking(true)} className="h-12 rounded-full bg-foreground text-[15px] font-semibold text-background">Check in</button>
                        <button type="button" onClick={() => void share()} className="flex h-12 items-center justify-center gap-2 rounded-full border border-border/60 text-[15px] font-medium"><Share2 className="h-4 w-4" />Share link</button>
                    </div>

                    <Section title="Tickets">
                        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-muted/60">
                            {summary.by_tier.map((tier) => (
                                <li key={tier.id} className="px-4 py-3.5">
                                    <div className="flex items-baseline justify-between gap-3 text-[15px]">
                                        <span className="min-w-0 truncate">{tier.name} <span className="text-muted-foreground">· {tier.price ? formatMoney(tier.price, summary.event.currency) : "Free"}</span></span>
                                        <span className="shrink-0 font-semibold">{tier.sold}{tier.capacity ? <span className="font-normal text-muted-foreground"> / {tier.capacity}</span> : null}</span>
                                    </div>
                                    {tier.capacity ? (
                                        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-foreground/10">
                                            <div className="h-full rounded-full bg-foreground" style={{ width: `${Math.min(100, Math.round((tier.sold / tier.capacity) * 100))}%` }} />
                                        </div>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    </Section>

                    <Section title={`Guests · ${guests.length}`}>
                        {guests.length > 0 ? (
                            <>
                                <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Find a name, phone or code" className="h-12 w-full rounded-full bg-muted/60 px-5 text-[15px] outline-none placeholder:text-muted-foreground" />
                                {shown.length > 0 ? (
                                    <>
                                        <ul className="mt-2 divide-y divide-border/60 overflow-hidden rounded-2xl bg-muted/60">
                                            {shown.slice(current * GUESTS_PER_PAGE, (current + 1) * GUESTS_PER_PAGE).map((guest) => <GuestRow key={guest.id} guest={guest} tier={summary.event.tiers.find((tier) => tier.id === guest.tier_id)?.name ?? ""} />)}
                                        </ul>
                                        {pages > 1 && (
                                            <div className="mt-3 flex items-center justify-between">
                                                <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="flex h-9 items-center gap-1 rounded-full border border-border/60 pl-2.5 pr-3.5 text-[13px] font-semibold disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Previous</button>
                                                <span className="text-[13px] text-muted-foreground">{current + 1} of {pages}</span>
                                                <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="flex h-9 items-center gap-1 rounded-full border border-border/60 pl-3.5 pr-2.5 text-[13px] font-semibold disabled:opacity-40">Next<ChevronRight className="h-4 w-4" /></button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p className="mt-3 text-[14px] text-muted-foreground">No one by that name, phone or code.</p>
                                )}
                            </>
                        ) : (
                            <p className="text-[14px] text-muted-foreground">Share the link and tickets show up here as they sell.</p>
                        )}
                    </Section>

                    {error && <p role="alert" className="mt-3 text-[13px] text-destructive">{error}</p>}
                    <button type="button" disabled={busy} onClick={() => void setStatus(summary.event.status === "live" ? "closed" : "live")} className="mt-6 w-full text-center text-[13px] text-muted-foreground disabled:opacity-50">
                        {summary.event.status === "live" ? "Stop selling tickets" : "Sell tickets again"}
                    </button>
                    <CheckInSheet open={checking} onOpenChange={setChecking} eventId={id} onCheckedIn={() => void query.refetch()} />
                </>
            )}
        </div>
    );
}

/** A part of the event page under its small label, with room above it. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="mt-9">
            <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h2>
            {children}
        </section>
    );
}

/** ₦2,465,000 → ₦2.47m, so the number fits a third of the card. */
function shortMoney(amount: number, currency: string): string {
    if (currency !== "NGN") return formatMoney(amount, currency);
    if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}m`;
    if (amount >= 10_000) return `₦${Math.round(amount / 1_000)}k`;
    return formatMoney(amount, currency);
}

function GuestRow({ guest, tier }: { guest: StudioGuest; tier: string }) {
    return (
        <li className="flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{guest.buyer_name || "Guest"}</span>
                <span className="block truncate text-[13px] text-muted-foreground">{tier} · {guest.code}{guest.buyer_phone ? ` · ${guest.buyer_phone}` : ""}</span>
            </span>
            <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold", guest.checked_in_at ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
                {guest.checked_in_at ? "In" : "Not yet"}
            </span>
        </li>
    );
}

type CheckInResult =
    | { ok: true; ticket: { buyer_name: string; code: string }; tier: string }
    | { ok: false; reason: "not_found" | "not_paid" | "already"; ticket?: { buyer_name: string; code: string; checked_in_at: string | null }; tier?: string };

type Detector = { detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>> };

/**
 * The door: scan a ticket's QR with the camera (where the phone's browser can
 * read codes), or type the code printed under it.
 */
function CheckInSheet({ open, onOpenChange, eventId, onCheckedIn }: { open: boolean; onOpenChange: (open: boolean) => void; eventId: string; onCheckedIn: () => void }) {
    const { project } = useStudio();
    const video = useRef<HTMLVideoElement>(null);
    const [scanning, setScanning] = useState(false);
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<CheckInResult | null>(null);
    const last = useRef<{ value: string; at: number } | null>(null);
    const canScan = typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;

    const submit = async (value: string) => {
        if (!value.trim()) return;
        setBusy(true);
        try {
            const response = await studioFetch("/api/studio/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: project.id, action: "checkin", event_id: eventId, code: value }) });
            const body = await response.json() as CheckInResult;
            setResult(body);
            if (body.ok) {
                navigator.vibrate?.(60);
                onCheckedIn();
            }
            setCode("");
        } catch {
            setResult({ ok: false, reason: "not_found" });
        } finally {
            setBusy(false);
        }
    };

    useEffect(() => {
        if (!open || !scanning || !canScan) return;
        let stream: MediaStream | null = null;
        let stopped = false;
        let timer: number | undefined;
        const detector = new (window as unknown as { BarcodeDetector: new (options: { formats: string[] }) => Detector }).BarcodeDetector({ formats: ["qr_code"] });
        void (async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
                if (stopped || !video.current) return;
                video.current.srcObject = stream;
                await video.current.play();
                const tick = async () => {
                    if (stopped || !video.current) return;
                    const found = await detector.detect(video.current).catch(() => []);
                    const value = found[0]?.rawValue;
                    // The same code held in front of the camera is read once every few seconds, not every frame.
                    if (value && !(last.current?.value === value && Date.now() - last.current.at < 4000)) {
                        last.current = { value, at: Date.now() };
                        await submit(value);
                    }
                    timer = window.setTimeout(() => void tick(), 300);
                };
                void tick();
            } catch {
                setScanning(false);
            }
        })();
        return () => {
            stopped = true;
            window.clearTimeout(timer);
            stream?.getTracks().forEach((track) => track.stop());
        };
    }, [open, scanning, canScan]); // eslint-disable-line react-hooks/exhaustive-deps

    const tone = result ? (result.ok ? "bg-emerald-600 text-white" : result.reason === "already" ? "bg-amber-500 text-white" : "bg-destructive text-white") : "";
    const message = !result ? null
        : result.ok ? { title: "Checked in", body: `${result.ticket.buyer_name || "Guest"} · ${result.tier}` }
            : result.reason === "already" ? { title: "Already used", body: `${result.ticket?.buyer_name || "Guest"} · in at ${result.ticket?.checked_in_at ? new Date(result.ticket.checked_in_at).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" }) : ""}` }
                : result.reason === "not_paid" ? { title: "Not paid", body: "This ticket hasn't been paid for." }
                    : { title: "Not a ticket for this event", body: "Check the code and try again." };

    return (
        <Drawer.Root repositionInputs={false} open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) { setScanning(false); setResult(null); } }}>
            <Drawer.Portal>
                <Drawer.Overlay className={`fixed inset-0 z-50 bg-black/30 ${SHEET_OVERLAY_PHONE_ONLY}`} />
                <Drawer.Content className={`dashboard-theme fixed inset-x-0 bottom-0 z-50 mx-auto flex min-h-[55svh] max-h-[92svh] max-w-md lg:left-[var(--studio-sidebar,0px)] flex-col rounded-t-3xl border-t border-border/60 bg-background px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 font-sans text-foreground outline-none ${SHEET_AS_PAGE}`}>
                    <SheetPageBack />
                    <div className="flex h-10 items-center justify-between">
                        <Drawer.Title className="text-[17px] font-semibold">Check in</Drawer.Title>
                        <button type="button" onClick={() => onOpenChange(false)} aria-label="Close" className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full"><X className="h-5 w-5" /></button>
                    </div>
                    <Drawer.Description className="sr-only">Scan or type a ticket code.</Drawer.Description>
                    {message && (
                        <div className={cn("mt-2 rounded-2xl px-4 py-3.5", tone)}>
                            <p className="text-[17px] font-semibold">{message.title}</p>
                            <p className="mt-0.5 text-[14px] opacity-90">{message.body}</p>
                        </div>
                    )}
                    {canScan && (scanning ? (
                        <video ref={video} playsInline muted className="mt-3 aspect-square w-full rounded-2xl bg-black object-cover" />
                    ) : (
                        <button type="button" onClick={() => setScanning(true)} className="mt-3 h-12 w-full rounded-full bg-foreground text-[15px] font-semibold text-background">Scan tickets</button>
                    ))}
                    <form onSubmit={(event) => { event.preventDefault(); void submit(code); }} className="mt-3 flex gap-2">
                        <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} autoCapitalize="characters" autoCorrect="off" placeholder="Ticket code" className="h-12 min-w-0 flex-1 rounded-full bg-muted px-5 font-mono text-[16px] tracking-widest outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground" />
                        <button type="submit" disabled={busy || !code.trim()} className="flex h-12 items-center gap-2 rounded-full border border-border/60 px-5 text-[15px] font-semibold disabled:opacity-50">{busy && <Spinner className="h-4 w-4" />}Check</button>
                    </form>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
