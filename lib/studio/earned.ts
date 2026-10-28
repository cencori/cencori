import "server-only";

import type { createAdminClient } from "@/lib/supabaseAdmin";
import { getPaymentsConnection } from "@/lib/embedded/payments";
import { transferHistory } from "@/lib/embedded/transfers";
import { getCatalog } from "@/lib/embedded/catalog";

type Admin = ReturnType<typeof createAdminClient>;

export interface PaidEntry { amount: number; at: string }

/**
 * Money that came in through the assistant, counted like the Money tab: paid
 * links, confirmed transfers, and orders the owner marked paid (cash). In the
 * project's payment currency (naira unless set otherwise).
 */
export async function paidThroughAssistant(db: Admin, projectId: string): Promise<{ currency: string; connected: boolean; paid: PaidEntry[] }> {
    const [payments, transfers, catalog] = await Promise.all([
        getPaymentsConnection(db, projectId).catch(() => null),
        transferHistory(db, projectId).catch(() => []),
        getCatalog(db, projectId).catch(() => null),
    ]);
    const currency = payments?.metadata.currency ?? "NGN";
    const paid = [
        ...(payments?.metadata.payments ?? []).filter((entry) => entry.status === "paid" && entry.paid_at && entry.currency === currency).map((entry) => ({ amount: entry.amount, at: entry.paid_at! })),
        ...transfers.filter((entry) => entry.status === "paid" && entry.paid_at && entry.currency === currency).map((entry) => ({ amount: entry.amount, at: entry.paid_at! })),
        ...(catalog?.metadata.orders ?? []).filter((order) => order.paid_by === "owner" && order.paid_at && order.status !== "cancelled" && order.currency === currency).map((order) => ({ amount: order.total, at: order.paid_at! })),
    ];
    return { currency, connected: !!payments, paid };
}

export function earnedSince(paid: PaidEntry[], since: Date): { amount: number; count: number } {
    const inPeriod = paid.filter((entry) => new Date(entry.at).getTime() >= since.getTime());
    return { amount: inPeriod.reduce((sum, entry) => sum + entry.amount, 0), count: inPeriod.length };
}
