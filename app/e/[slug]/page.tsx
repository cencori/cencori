import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { eventBySlug, eventHost, seatsLeft } from "@/lib/studio/events";
import { EventFrame, money, when } from "@/app/e/shared";
import { BuyTickets } from "@/app/e/[slug]/BuyTickets";
import { MapPointIcon } from "@solar-icons/react/linear/map-point";
import { CalendarIcon } from "@solar-icons/react/linear/calendar";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const db = createAdminClient();
    const event = await eventBySlug(db, (await params).slug);
    if (!event) return { title: "Event not found" };
    const host = await eventHost(db, event);
    const from = Math.min(...event.tiers.map((tier) => tier.price));
    const description = `${host ? `Hosted by ${host} · ` : ""}${when(event)}${event.venue ? ` · ${event.venue}` : ""} · ${from === 0 ? "Free" : `From ${money(from, event.currency)}`}`;
    // The flyer is what people recognise when the link lands in a WhatsApp chat.
    const images = event.banner_url ? [{ url: event.banner_url }] : undefined;
    return { title: event.name, description, openGraph: { title: event.name, description, images }, twitter: { card: event.banner_url ? "summary_large_image" : "summary", images: event.banner_url ? [event.banner_url] : undefined }, robots: { index: false } };
}

/** The public event page: what, when, where, and the tickets. */
export default async function EventPage({ params }: Props) {
    const db = createAdminClient();
    const event = await eventBySlug(db, (await params).slug);
    if (!event || event.status === "cancelled") notFound();
    const [left, host] = await Promise.all([seatsLeft(db, event), eventHost(db, event)]);
    const over = Date.parse(event.ends_at ?? event.starts_at) + 6 * 3_600_000 < Date.now();
    return (
        <EventFrame>
            {event.banner_url && (
                // eslint-disable-next-line @next/next/no-img-element -- the owner's own upload on our file store; its size is unknown
                <img src={event.banner_url} alt="" className="-mt-2 mb-6 w-full rounded-3xl object-cover" />
            )}
            <header>
                <h1 className="text-3xl font-semibold leading-tight tracking-tight">{event.name}</h1>
                {host && <p className="mt-2 text-[15px] text-white/60">Hosted by <span className="font-semibold text-white">{host}</span></p>}
                <ul className="mt-6 space-y-3 text-[15px] leading-6 text-white/80">
                    {event.venue && (
                        <li className="flex gap-3">
                            <MapPointIcon size={20} className="mt-0.5 shrink-0 text-white/50" />
                            <span>{event.venue}</span>
                        </li>
                    )}
                    <li className="flex gap-3">
                        <CalendarIcon size={20} className="mt-0.5 shrink-0 text-white/50" />
                        <span>{when(event)}</span>
                    </li>
                </ul>
            </header>
            {event.description && (
                <Section title="Description">
                    <p className="whitespace-pre-line text-[15px] leading-7 text-white/80">{event.description}</p>
                </Section>
            )}
            <Section title="Tickets">
                {over || event.status !== "live" ? (
                    <p className="rounded-2xl bg-white/[0.06] px-4 py-4 text-[15px] text-white/60">{over ? "This event has happened." : "Tickets aren't on sale."}</p>
                ) : (
                    <BuyTickets slug={event.slug} currency={event.currency} tiers={event.tiers.map((tier) => ({ id: tier.id, name: tier.name, price: tier.price, left: left[tier.id] ?? null }))} />
                )}
            </Section>
        </EventFrame>
    );
}

/** A part of the page under its small label, with room above it. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="mt-10">
            <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/45">{title}</h2>
            {children}
        </section>
    );
}
