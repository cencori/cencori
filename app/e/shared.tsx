import type { ReactNode } from "react";
import type { StudioEvent } from "@/lib/studio/events";

/** Money on the event pages: ₦12,500, or the currency code for others. */
export function money(amount: number, currency: string): string {
    return currency === "NGN" ? `₦${Number(amount).toLocaleString("en-NG")}` : `${currency} ${Number(amount).toLocaleString("en-NG")}`;
}

/** "Sat 20 Dec, 8:00 pm", in the business's time zone (where its events are: lib/studio/business-zone.ts). */
export function when(event: Pick<StudioEvent, "starts_at" | "ends_at">, timeZone: string): string {
    const format = (iso: string, withDate: boolean) => new Intl.DateTimeFormat("en-GB", { timeZone, ...(withDate ? { weekday: "short", day: "numeric", month: "short" } : {}), hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
    return `${format(event.starts_at, true)}${event.ends_at ? ` – ${format(event.ends_at, new Date(event.ends_at).toDateString() !== new Date(event.starts_at).toDateString())}` : ""}`;
}

/** The frame every public event page shares: one phone-width column on black, like the flyers. */
export function EventFrame({ children }: { children: ReactNode }) {
    return (
        <main className="min-h-dvh bg-black px-4 py-8 font-sans text-white [color-scheme:dark]">
            <div className="mx-auto w-full max-w-md">
                {children}
                <p className="mt-10 text-center text-xs text-white/35">Tickets by Cencori Studio</p>
            </div>
        </main>
    );
}
