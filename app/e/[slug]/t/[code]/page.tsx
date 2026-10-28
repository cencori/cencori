import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { eventBySlug, type Ticket } from "@/lib/studio/events";
import { EventFrame } from "@/app/e/shared";
import { TicketCard } from "@/app/e/TicketCard";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

/** One ticket, where its QR leads when someone scans it with a phone camera. */
export default async function TicketPage({ params }: { params: Promise<{ slug: string; code: string }> }) {
    const { slug, code } = await params;
    const db = createAdminClient();
    const event = await eventBySlug(db, slug);
    if (!event || !/^[A-Z0-9]{5,12}$/.test(code)) notFound();
    const { data } = await db.from("studio_tickets" as never).select("id, event_id, tier_id, code, order_ref, buyer_name, buyer_phone, buyer_email, price, status, payment_reference, reserved_until, paid_at, checked_in_at, created_at").eq("event_id", event.id).eq("code", code).maybeSingle();
    const ticket = data as Ticket | null;
    if (!ticket || ticket.status !== "paid") notFound();
    return (
        <EventFrame>
            <TicketCard event={event} ticket={ticket} />
        </EventFrame>
    );
}
