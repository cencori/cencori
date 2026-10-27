/**
 * Studio's Money tab: what the business earned through its assistant, by
 * day, week or month, in its own time zone.
 *
 * Counted: payment links that were paid (deposits, orders, anything), bank
 * transfers the owner confirmed, and orders the owner marked paid (cash). An
 * order paid by link or transfer is counted once, through its payment.
 * Nothing else is known to Cencori, and the screen says so.
 */

import { localDate, localMidnight } from "@/lib/studio/time";

export type MoneyPeriod = "week" | "month" | "year";

export interface MoneyPayment { amount: number; currency: string; status: string; paid_at: string | null; description?: string | null }
export interface MoneyOrderItem { name: string; quantity: number; price: number }
export interface MoneyOrder { total: number; currency: string; status: string; paid_at: string | null; paid_by?: "link" | "transfer" | "owner" | null; payment_reference?: string | null; items: MoneyOrderItem[] }

export interface MoneySummary {
    period: MoneyPeriod;
    currency: string;
    total: number;
    previous: number;
    by_link: number;
    by_transfer: number;
    marked_paid: number;
    /** Orders not paid yet, whenever they were placed. */
    to_collect: number;
    paid_count: number;
    bars: Array<{ label: string; amount: number; current: boolean }>;
    top_items: Array<{ name: string; quantity: number; amount: number }>;
}

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function periodStart(period: MoneyPeriod, timeZone: string, now: Date): Date {
    const today = localDate(timeZone, now);
    if (period === "year") return localMidnight(timeZone, today.year, 1, 1);
    if (period === "month") return localMidnight(timeZone, today.year, today.month, 1);
    // The last seven days, today included.
    const weekAgo = new Date(Date.UTC(today.year, today.month - 1, today.day - 6));
    return localMidnight(timeZone, weekAgo.getUTCFullYear(), weekAgo.getUTCMonth() + 1, weekAgo.getUTCDate());
}

export function summarizeMoney(input: { payments: MoneyPayment[]; transfers?: MoneyPayment[]; orders: MoneyOrder[]; period: MoneyPeriod; timeZone: string; currency: string; now?: Date }): MoneySummary {
    const now = input.now ?? new Date();
    const { period, timeZone, currency } = input;
    const start = periodStart(period, timeZone, now);
    const previousStart = new Date(start.getTime() - (now.getTime() - start.getTime()));

    // Every amount that came in, once: paid links, and orders the owner marked paid.
    const income = [
        ...input.payments.filter((p) => p.status === "paid" && p.paid_at && p.currency === currency).map((p) => ({ amount: p.amount, at: new Date(p.paid_at!), how: "link" as const })),
        ...(input.transfers ?? []).filter((t) => t.status === "paid" && t.paid_at && t.currency === currency).map((t) => ({ amount: t.amount, at: new Date(t.paid_at!), how: "transfer" as const })),
        ...input.orders.filter((o) => o.paid_by === "owner" && o.paid_at && o.currency === currency && o.status !== "cancelled").map((o) => ({ amount: o.total, at: new Date(o.paid_at!), how: "owner" as const })),
    ];
    const inPeriod = income.filter((entry) => entry.at >= start && entry.at <= now);
    const sum = (list: Array<{ amount: number }>) => list.reduce((total, entry) => total + entry.amount, 0);

    const today = localDate(timeZone, now);
    const bars: MoneySummary["bars"] = [];
    if (period === "week") {
        for (let back = 6; back >= 0; back--) {
            const day = new Date(Date.UTC(today.year, today.month - 1, today.day - back));
            const from = localMidnight(timeZone, day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate());
            const to = localMidnight(timeZone, day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate() + 1);
            bars.push({ label: WEEKDAY[day.getUTCDay()], amount: sum(inPeriod.filter((e) => e.at >= from && e.at < to)), current: back === 0 });
        }
    } else if (period === "month") {
        const daysInMonth = new Date(Date.UTC(today.year, today.month, 0)).getUTCDate();
        for (let week = 0; week * 7 < daysInMonth; week++) {
            const amount = sum(inPeriod.filter((e) => Math.floor((localDate(timeZone, e.at).day - 1) / 7) === week));
            bars.push({ label: `W${week + 1}`, amount, current: Math.floor((today.day - 1) / 7) === week });
        }
    } else {
        for (let month = 1; month <= 12; month++) {
            bars.push({ label: MONTH[month - 1], amount: sum(inPeriod.filter((e) => localDate(timeZone, e.at).month === month)), current: month === today.month });
        }
    }

    // What sold best: paid orders' items, by money in.
    const items = new Map<string, { name: string; quantity: number; amount: number }>();
    for (const order of input.orders) {
        if (!order.paid_at || order.status === "cancelled" || order.currency !== currency) continue;
        const at = new Date(order.paid_at);
        if (at < start || at > now) continue;
        for (const item of order.items) {
            const current = items.get(item.name) ?? { name: item.name, quantity: 0, amount: 0 };
            current.quantity += item.quantity;
            current.amount += item.quantity * item.price;
            items.set(item.name, current);
        }
    }

    return {
        period,
        currency,
        total: sum(inPeriod),
        previous: sum(income.filter((entry) => entry.at >= previousStart && entry.at < start)),
        by_link: sum(inPeriod.filter((e) => e.how === "link")),
        by_transfer: sum(inPeriod.filter((e) => e.how === "transfer")),
        marked_paid: sum(inPeriod.filter((e) => e.how === "owner")),
        to_collect: input.orders.filter((o) => (o.status === "new" || o.status === "awaiting_payment") && o.currency === currency).reduce((total, o) => total + o.total, 0),
        paid_count: inPeriod.length,
        bars,
        top_items: [...items.values()].sort((a, b) => b.amount - a.amount).slice(0, 5),
    };
}
