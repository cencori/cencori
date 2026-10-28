import QRCode from "qrcode";
import type { StudioEvent, Ticket } from "@/lib/studio/events";
import { when } from "@/app/e/shared";

/** The address a ticket's QR holds: its own page, which the door's scanner also reads. */
export function ticketUrl(slug: string, code: string): string {
    return `https://studio.cencori.com/e/${slug}/t/${code}`;
}

/** One ticket: the QR the door scans, and the code to type if it can't. White on the black page: QR codes scan best dark on light. */
export async function TicketCard({ event, ticket }: { event: StudioEvent; ticket: Ticket }) {
    const qr = await QRCode.toDataURL(ticketUrl(event.slug, ticket.code), { margin: 1, width: 440, errorCorrectionLevel: "M" });
    const tier = event.tiers.find((item) => item.id === ticket.tier_id)?.name ?? "Ticket";
    return (
        <div className="overflow-hidden rounded-3xl bg-white text-zinc-900">
            <div className="px-5 pt-5">
                <p className="text-[13px] font-medium text-zinc-500">{when(event)}</p>
                <p className="mt-0.5 text-lg font-semibold leading-tight">{event.name}</p>
                <p className="mt-1 text-[14px] text-zinc-600">{tier} · {ticket.buyer_name}</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- a generated data URL, not a remote image */}
            <img src={qr} alt={`Ticket ${ticket.code}`} className="mx-auto my-4 h-56 w-56" />
            <div className="flex items-center justify-between border-t border-dashed border-zinc-200 px-5 py-3.5">
                <span className="font-mono text-[17px] font-semibold tracking-[0.2em]">{ticket.code}</span>
                <span className={ticket.checked_in_at ? "text-[13px] font-semibold text-zinc-400" : "text-[13px] font-semibold text-emerald-600"}>{ticket.checked_in_at ? "Used" : "Valid"}</span>
            </div>
        </div>
    );
}
