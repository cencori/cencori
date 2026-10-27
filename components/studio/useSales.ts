"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { studioFetch } from "@/components/studio/studio-data";
import { useStudio } from "@/components/studio/StudioShell";

export interface SalesOrder {
    id: string;
    items: Array<{ name: string; option: string | null; quantity: number }>;
    total: number;
    currency: string;
    customer: string | null;
    delivery: string | null;
    note: string | null;
    status: "awaiting_payment" | "paid" | "new" | "done" | "cancelled";
    paid_by: "link" | "transfer" | "owner" | null;
    conversation_id: string | null;
    created_at: string;
    paid_at: string | null;
}

export interface SalesBooking {
    id: string;
    title: string;
    start: string | null;
    detail: string | null;
    status: "confirmed" | "done" | "cancelled";
    conversation_id: string | null;
    created_at: string;
    deposit: { amount: number; currency: string } | null;
}

export interface Sales {
    currency: string;
    has_products: boolean;
    orders: SalesOrder[];
    bookings: SalesBooking[];
}

export function useSales() {
    const { project } = useStudio();
    return useQuery({
        queryKey: ["studio-sales", project.id],
        queryFn: async (): Promise<Sales> => {
            const response = await studioFetch(`/api/studio/sales?project_id=${project.id}`, { cache: "no-store" });
            const body = await response.json().catch(() => null);
            if (!response.ok) throw new Error((body as { error?: string } | null)?.error ?? "Couldn't load your sales.");
            return body as Sales;
        },
        refetchInterval: 30_000,
        refetchOnWindowFocus: true,
    });
}

/** Mark an order paid, or an order or booking done or cancelled. */
export function useSalesAction() {
    const { project } = useStudio();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: { kind: "order" | "booking"; id: string; action: "paid" | "done" | "cancelled" }) => {
            const response = await studioFetch("/api/studio/sales", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project_id: project.id, ...input }),
            });
            const body = await response.json().catch(() => null);
            if (!response.ok) throw new Error((body as { error?: string } | null)?.error ?? "That didn't work. Try again.");
            return body as Sales;
        },
        onSuccess: (data) => {
            queryClient.setQueryData(["studio-sales", project.id], data);
            void queryClient.invalidateQueries({ queryKey: ["studio-overview", project.id] });
            void queryClient.invalidateQueries({ queryKey: ["studio-money", project.id] });
        },
    });
}

/** "Fri 30 Oct, 8:00 pm" for a booking's start; the raw text when it isn't a date. */
export function bookingWhen(start: string | null): string | null {
    if (!start) return null;
    const date = new Date(start);
    if (Number.isNaN(date.getTime())) return start;
    if (/^\d{4}-\d{2}-\d{2}$/.test(start)) return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
    return date.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}
