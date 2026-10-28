"use client";

import { useState } from "react";
import { StudioLoadError } from "@/components/studio/studio-data";
import { StudioLink } from "@/components/studio/studio-nav";
import { MessageCircle } from "lucide-react";
import { useStudioTasks } from "@/components/studio/StudioTasks";
import { formatMoney } from "@/components/studio/useStudioOverview";
import { shortTime } from "@/components/studio/useInbox";
import { bookingWhen, useSales, useSalesAction, type SalesBooking, type SalesOrder } from "@/components/studio/useSales";
import { Bag4Icon } from "@solar-icons/react/bold-duotone/bag-4";
import { BoxIcon } from "@solar-icons/react/bold-duotone/box";
import { CalendarIcon } from "@solar-icons/react/bold-duotone/calendar";
import { STUDIO_FILL_PAGE, StudioEmptyCard } from "@/components/studio/StudioEmptyCard";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { EventsList } from "@/components/studio/views/EventsView";

const tag = {
    good: "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
    wait: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    off: "bg-muted text-muted-foreground",
};

function orderStatus(order: SalesOrder): { label: string; tone: keyof typeof tag } {
    if (order.status === "paid") return { label: order.paid_by === "owner" ? "Marked paid" : order.paid_by === "transfer" ? "Paid by transfer" : "Paid by link", tone: "good" };
    if (order.status === "awaiting_payment") return { label: "Waiting for payment", tone: "wait" };
    if (order.status === "new") return { label: "Not paid yet", tone: "wait" };
    if (order.status === "done") return { label: "Done", tone: "off" };
    return { label: "Cancelled", tone: "off" };
}

function bookingStatus(booking: SalesBooking): { label: string; tone: keyof typeof tag } {
    if (booking.status === "done") return { label: "Came", tone: "off" };
    if (booking.status === "cancelled") return { label: "Cancelled", tone: "off" };
    const start = booking.start ? new Date(booking.start) : null;
    if (start && !Number.isNaN(start.getTime()) && start.getTime() < Date.now()) return { label: "Did they come?", tone: "wait" };
    return { label: "Booked", tone: "good" };
}

function SmallButton({ children, onClick, disabled, strong }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; strong?: boolean }) {
    return (
        <button type="button" onClick={onClick} disabled={disabled} className={cn("h-8 rounded-full px-3 text-[13px] font-medium disabled:opacity-50", strong ? "bg-foreground text-background" : "border border-border/60")}>
            {children}
        </button>
    );
}

/** Orders, bookings and events: what, who, when, paid or not. */
export default function StudioSalesPage() {
    // A ticket notification opens ?view=events.
    const [view, setView] = useState<"orders" | "bookings" | "events">(() => (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "events" ? "events" : "orders"));
    const sales = useSales();
    const act = useSalesAction();
    const tasks = useStudioTasks();
    const data = sales.data;
    const orders = data?.orders ?? [];
    const bookings = data?.bookings ?? [];
    const toCollect = orders.filter((o) => o.status === "new" || o.status === "awaiting_payment");
    const empty = view !== "events" && !!sales.data && (view === "orders" ? orders : bookings).length === 0;

    return (
        <div className={empty ? STUDIO_FILL_PAGE : undefined}>
            {/* The title and switcher stay put while the page scrolls under them. */}
            <div className="sticky top-0 z-30 -mx-4 -mt-[calc(1.25rem+env(safe-area-inset-top))] bg-background px-4 pb-3 pt-[calc(1.25rem+env(safe-area-inset-top))] lg:-mx-10 lg:-mt-10 lg:px-10 lg:pt-10">
                <h1 className="text-[26px] font-semibold leading-tight tracking-tight">Sales</h1>
                <div role="tablist" aria-label="Show" className="mt-4 grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
                    {(["orders", "bookings", "events"] as const).map((id) => (
                        <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={cn("h-9 rounded-full text-sm font-medium", view === id ? "bg-background text-foreground" : "text-muted-foreground")}>
                            {id === "orders" ? `Orders${orders.length ? ` · ${orders.length}` : ""}` : id === "bookings" ? `Bookings${bookings.length ? ` · ${bookings.length}` : ""}` : "Events"}
                        </button>
                    ))}
                </div>
                {/* Stays put with the title while the events scroll under it. */}
                {view === "events" && (
                    <button type="button" onClick={() => tasks.open("event")} className="mt-3 h-11 w-full rounded-full bg-foreground text-[15px] font-semibold text-background">New event</button>
                )}
            </div>
            {act.error && <p role="alert" className="mt-3 text-[13px] text-destructive">{act.error.message}</p>}

            {view === "events" ? (
                <EventsList />
            ) : sales.isLoading ? (
                <div className="mt-4 space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>
            ) : !sales.data ? (
                <StudioLoadError error={sales.error} fallback="Couldn't load your sales." onRetry={() => void sales.refetch()} />
            ) : view === "orders" ? (
                orders.length === 0 ? (
                    data?.has_products ? (
                        <StudioEmptyCard icon={Bag4Icon} title="No orders yet" description="When customers order from your assistant, they show up here." />
                    ) : (
                        <StudioEmptyCard icon={BoxIcon} title="No products yet" description="Your assistant can take orders once it has your product list.">
                            <button type="button" onClick={() => tasks.open("products")} className="mt-4 h-11 rounded-full bg-foreground px-5 text-sm font-semibold text-background">Add your products</button>
                        </StudioEmptyCard>
                    )
                ) : (
                    <>
                        {toCollect.length > 0 && (
                            <p className="mt-4 text-[13px] text-muted-foreground">
                                {formatMoney(toCollect.reduce((sum, o) => sum + o.total, 0), data!.currency)} still to collect from {toCollect.length} {toCollect.length === 1 ? "order" : "orders"}
                            </p>
                        )}
                        <ul className="-mx-4 mt-2 lg:mx-0">
                            {orders.map((order) => {
                                const status = orderStatus(order);
                                const unpaid = order.status === "new" || order.status === "awaiting_payment";
                                return (
                                    <li key={order.id} className="border-b border-border/40 px-4 py-3.5">
                                        <div className="flex items-start gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[15px] font-semibold">{order.customer ?? order.id}<span className="ml-2 text-xs font-normal text-muted-foreground">{shortTime(order.created_at)}</span></p>
                                                <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">
                                                    {order.items.map((item) => `${item.quantity} × ${item.name}${item.option ? ` (${item.option})` : ""}`).join(", ")}
                                                </p>
                                                {order.delivery && <p className="mt-0.5 truncate text-[13px] text-muted-foreground">To: {order.delivery}</p>}
                                                <span className={cn("mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold", tag[status.tone])}>{status.label}</span>
                                            </div>
                                            <p className="shrink-0 text-[15px] font-semibold">{formatMoney(order.total, order.currency)}</p>
                                        </div>
                                        {(unpaid || order.status === "paid") && (
                                            <div className="mt-2.5 flex flex-wrap gap-2">
                                                {unpaid && <SmallButton strong disabled={act.isPending} onClick={() => act.mutate({ kind: "order", id: order.id, action: "paid" })}>Mark as paid</SmallButton>}
                                                {order.status === "paid" && <SmallButton disabled={act.isPending} onClick={() => act.mutate({ kind: "order", id: order.id, action: "done" })}>Sent / done</SmallButton>}
                                                <SmallButton disabled={act.isPending} onClick={() => act.mutate({ kind: "order", id: order.id, action: "cancelled" })}>Cancel</SmallButton>
                                                {order.conversation_id && <StudioLink href={`/inbox/${order.conversation_id}`} aria-label="Open the chat" className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60"><MessageCircle className="h-4 w-4" /></StudioLink>}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )
            ) : bookings.length === 0 ? (
                <StudioEmptyCard icon={CalendarIcon} title="No bookings yet" description="When your assistant books a table or an appointment, it shows up here." />
            ) : (
                <ul className="-mx-4 mt-3 lg:mx-0">
                    {bookings.map((booking) => {
                        const status = bookingStatus(booking);
                        return (
                            <li key={booking.id} className="border-b border-border/40 px-4 py-3.5">
                                <p className="text-[15px] font-semibold">{booking.title}</p>
                                {bookingWhen(booking.start) && <p className="mt-0.5 text-[13px] text-foreground/80">{bookingWhen(booking.start)}</p>}
                                {booking.detail && <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-muted-foreground">{booking.detail}</p>}
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", tag[status.tone])}>{status.label}</span>
                                    {booking.deposit && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", tag.good)}>Deposit paid · {formatMoney(booking.deposit.amount, booking.deposit.currency)}</span>}
                                </div>
                                {booking.status === "confirmed" && (
                                    <div className="mt-2.5 flex flex-wrap gap-2">
                                        <SmallButton disabled={act.isPending} onClick={() => act.mutate({ kind: "booking", id: booking.id, action: "done" })}>They came</SmallButton>
                                        <SmallButton disabled={act.isPending} onClick={() => act.mutate({ kind: "booking", id: booking.id, action: "cancelled" })}>Cancelled</SmallButton>
                                        {booking.conversation_id && <StudioLink href={`/inbox/${booking.conversation_id}`} aria-label="Open the chat" className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60"><MessageCircle className="h-4 w-4" /></StudioLink>}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
