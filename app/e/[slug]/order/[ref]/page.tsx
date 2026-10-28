import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { eventBySlug, eventHost, orderTickets } from "@/lib/studio/events";
import { findPayment, settlePayment } from "@/lib/embedded/payments";
import { getTransfers, transferInstructions } from "@/lib/embedded/transfers";
import { EventFrame, money } from "@/app/e/shared";
import { TicketCard } from "@/app/e/TicketCard";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

/**
 * An order's page: the tickets once paid; until then, how to pay (the
 * payment link again, or the transfer details), checked on every visit.
 */
export default async function OrderPage({ params }: { params: Promise<{ slug: string; ref: string }> }) {
    const { slug, ref } = await params;
    const db = createAdminClient();
    const event = await eventBySlug(db, slug);
    let tickets = event ? await orderTickets(db, ref) : [];
    if (!event || !tickets.length || tickets[0].event_id !== event.id) notFound();

    const reference = tickets[0].payment_reference;
    let link: string | null = null;
    let transfer: string | null = null;
    if (tickets[0].status === "reserved" && reference?.startsWith("cen_")) {
        // Back from the payment page, or a refresh: ask the provider.
        const found = await findPayment(db, reference);
        if (found) {
            const payment = await settlePayment(db, found.connection, found.payment).catch(() => found.payment);
            if (payment.status === "paid") tickets = await orderTickets(db, ref);
            else link = found.payment.link ?? null;
        }
    } else if (tickets[0].status === "reserved" && reference?.startsWith("TRF-")) {
        const transfers = await getTransfers(db, event.project_id);
        const entry = transfers?.metadata.transfers.find((item) => item.reference === reference);
        if (transfers && entry) transfer = transferInstructions(transfers.metadata.account, money(entry.amount, entry.currency), reference);
    }

    const total = tickets.reduce((sum, ticket) => sum + Number(ticket.price), 0);
    const host = await eventHost(db, event);
    const status = tickets[0].status;
    return (
        <EventFrame>
            <h1 className="text-2xl font-semibold tracking-tight">{status === "paid" ? `Your ticket${tickets.length === 1 ? "" : "s"}` : status === "cancelled" ? "Order cancelled" : "Almost there"}</h1>
            {status === "paid" ? (
                <>
                    <p className="mt-1 text-[15px] text-white/60">Show the QR code at the door. Screenshot it, or keep this page.</p>
                    <div className="mt-5 space-y-4">
                        {tickets.map((ticket) => <TicketCard key={ticket.id} event={event} ticket={ticket} />)}
                    </div>
                </>
            ) : status === "cancelled" ? (
                <p className="mt-2 text-[15px] text-white/60">These tickets weren&apos;t paid for in time. <a href={`/e/${event.slug}`} className="font-semibold text-white underline">Get tickets again</a>.</p>
            ) : (
                <div className="mt-3 rounded-2xl bg-white/[0.06] px-4 py-4">
                    <p className="text-[15px] font-semibold">{tickets.length} × {event.tiers.find((tier) => tier.id === tickets[0].tier_id)?.name} · {money(total, event.currency)}</p>
                    {transfer ? (
                        <>
                            <p className="mt-2 whitespace-pre-line text-[15px] leading-6 text-white/80">{transfer}</p>
                            <p className="mt-3 text-[13px] text-white/50">Your tickets appear here once {host || "the host"} confirms the transfer. Keep this page.</p>
                        </>
                    ) : link ? (
                        <>
                            <p className="mt-2 text-[15px] text-white/60">Your seats are held for a few minutes while you pay.</p>
                            <a href={link} className="mt-4 flex h-12 items-center justify-center rounded-full bg-white text-[15px] font-semibold text-black">Pay {money(total, event.currency)}</a>
                            <a href="" className="mt-2 block text-center text-[13px] text-white/50">I&apos;ve paid, check again</a>
                        </>
                    ) : (
                        <p className="mt-2 text-[15px] text-white/60">Waiting for your payment.</p>
                    )}
                </div>
            )}
        </EventFrame>
    );
}
