import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/studio/push", () => ({ pushToOwners: vi.fn() }));
vi.mock("@/lib/studio/business-zone", () => ({ businessTimeZone: vi.fn(async () => "Africa/Lagos") }));
vi.mock("@/lib/embedded/owner-alerts", () => ({ notifyBooking: vi.fn(async () => undefined), bookingFromArgs: () => ({ title: "x", start: null, detail: null }) }));
const payments = vi.hoisted(() => {
    const state = { connected: true };
    return {
        state,
        getPaymentsConnection: vi.fn(async () => (state.connected ? { metadata: { currency: "NGN" } } : null)),
        requestPayment: vi.fn(async () => ({ ok: true, link: "https://pay.example/abc", reference: "cen_000000000000000001", amount: "₦5,000" })),
        customerOf: vi.fn(async () => ({ label: null, number: null })),
    };
});
vi.mock("@/lib/embedded/payments", () => payments);
vi.mock("@/lib/embedded/transfers", () => ({ getTransfers: vi.fn(async () => null), startTransfer: vi.fn() }));

import { changeBookings, listBookings } from "@/lib/embedded/bookings";
import { bookAppointment, markAppointmentPaid, reminderDue, sweepSchedules } from "@/lib/studio/schedule";
import { DEFAULT_SETTINGS, parseStart } from "@/lib/studio/schedule-slots";

type Row = { id: string; project_id: string; connector_slug: string; status: string; metadata: Record<string, unknown>; created_at: string };

/** tool_connections (and nothing else), with the filters the modules use, including the rev compare-and-swap. */
function fakeDb(rows: Row[] = []) {
    let writes = 0;
    const db = {
        from: (table: string) => {
            const filters: Array<(row: Row) => boolean> = [];
            let patch: Record<string, unknown> | null = null;
            const run = () => (table === "tool_connections" ? rows.filter((row) => filters.every((test) => test(row))) : []);
            const builder: Record<string, unknown> = {
                select: () => builder,
                order: () => builder,
                limit: () => builder,
                eq: (column: string, value: unknown) => {
                    filters.push((row) => {
                        if (column.startsWith("metadata->>")) return String((row.metadata as Record<string, unknown>)[column.slice(11)] ?? "") === String(value);
                        return (row as unknown as Record<string, unknown>)[column] === value;
                    });
                    return builder;
                },
                is: (column: string) => {
                    filters.push((row) => (row.metadata as Record<string, unknown>)[column.replace("metadata->", "")] == null);
                    return builder;
                },
                maybeSingle: async () => ({ data: run().sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null }),
                single: async () => ({ data: run()[0] ?? null, error: null }),
                update: (value: Record<string, unknown>) => { patch = value; return builder; },
                insert: async (value: Omit<Row, "id" | "created_at">) => {
                    rows.push({ ...value, id: `row${rows.length + 1}`, created_at: new Date(Date.now() + rows.length).toISOString() } as Row);
                    return { error: null };
                },
                then: (resolve: (value: unknown) => void) => {
                    if (patch) {
                        const hit = run();
                        hit.forEach((row) => Object.assign(row, patch));
                        writes += hit.length;
                        return Promise.resolve({ data: hit.map((row) => ({ id: row.id })), error: null }).then(resolve);
                    }
                    return Promise.resolve({ data: run(), error: null }).then(resolve);
                },
            };
            return builder;
        },
    };
    return { db: db as never, rows, writes: () => writes };
}

const PROJECT = "11111111-1111-1111-1111-111111111111";
const scheduleRow = (settings: Record<string, unknown>): Row => ({ id: "sched", project_id: PROJECT, connector_slug: "schedule", status: "active", metadata: { kind: "schedule", settings, updated_at: "" }, created_at: "2026-10-01T00:00:00Z" });
const braids = { id: "s_braids1", name: "Knotless braids", minutes: 240, price: 25000, deposit: 5000 };
const start = parseStart("2026-12-01T10:00", "Africa/Lagos")!;

// Two first-time dynamic imports of one mocked module at once can hand one of them the real module; load the mocks first.
beforeAll(async () => {
    await import("@/lib/embedded/payments");
    await import("@/lib/embedded/transfers");
});

beforeEach(() => {
    payments.state.connected = true;
    payments.requestPayment.mockClear();
});

describe("changeBookings", () => {
    it("only one of two writers racing for the same version lands; the other runs again on the new list", async () => {
        const { db, rows } = fakeDb([{ id: "bk", project_id: PROJECT, connector_slug: "bookings", status: "active", metadata: { kind: "bookings", rev: 3, bookings: [] }, created_at: "2026-10-01T00:00:00Z" }]);
        let runs = 0;
        // Someone else writes between our read and our write: ours misses and runs again on their list.
        const result = await changeBookings(db, PROJECT, (bookings) => {
            runs++;
            if (runs === 1) {
                const [row] = rows;
                row.metadata = { ...row.metadata, rev: 4, bookings: [{ id: "other" }] };
            }
            return { bookings: [...bookings, { id: `mine-${runs}` } as never], result: bookings.length };
        });
        expect(result.ok).toBe(true);
        expect(runs).toBe(2);
        const ids = (await listBookings(db, PROJECT)).map((booking) => booking.id);
        expect(ids).toContain("other");
        expect(ids).toEqual(["other", "mine-2"]);
    });
});

describe("bookAppointment", () => {
    it("holds the slot and sends a deposit link when the service has a deposit", async () => {
        const { db } = fakeDb([scheduleRow({ ...DEFAULT_SETTINGS, services: [braids] })]);
        const result = await bookAppointment({ db, projectId: PROJECT, agentId: "agent", surface: "conversation", conversationId: "chat1" }, { service: "knotless", start, name: "Tolu", phone: "2348012345678", note: null });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.booking.status).toBe("held");
        expect(result.payment).toEqual({ kind: "link", link: "https://pay.example/abc", amount: "₦5,000" });
        expect(payments.requestPayment).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ amount: 5000, description: "Deposit: Knotless braids, Tuesday 1 December at 10am" }));
        const [stored] = await listBookings(db, PROJECT);
        expect(stored.deposit_due?.reference).toBe("cen_000000000000000001");
    });

    it("won't give the same chair twice", async () => {
        const { db } = fakeDb([scheduleRow({ ...DEFAULT_SETTINGS, services: [braids] })]);
        const ctx = { db, projectId: PROJECT, agentId: "agent", surface: "conversation" as const, conversationId: "chat1" };
        await bookAppointment(ctx, { service: "Knotless braids", start, name: "Tolu", phone: null, note: null });
        const second = await bookAppointment({ ...ctx, conversationId: "chat2" }, { service: "Knotless braids", start: new Date(start.getTime() + 3_600_000), name: "Kemi", phone: null, note: null });
        expect(second).toEqual({ ok: false, message: "That time is taken." });
    });

    it("confirms straight away with no way to take a deposit", async () => {
        payments.state.connected = false;
        const { db } = fakeDb([scheduleRow({ ...DEFAULT_SETTINGS, services: [braids] })]);
        const result = await bookAppointment({ db, projectId: PROJECT, agentId: "agent", surface: "conversation", conversationId: "chat1" }, { service: "braids", start, name: "Tolu", phone: null, note: null });
        expect(result.ok && result.booking.status).toBe("confirmed");
        expect(payments.requestPayment).not.toHaveBeenCalled();
    });

    it("a paid deposit confirms it", async () => {
        const { db } = fakeDb([scheduleRow({ ...DEFAULT_SETTINGS, services: [braids] })]);
        await bookAppointment({ db, projectId: PROJECT, agentId: "agent", surface: "conversation", conversationId: null }, { service: "braids", start, name: "Tolu", phone: null, note: null });
        expect(await markAppointmentPaid(db, PROJECT, "cen_000000000000000001")).toBe(true);
        const [stored] = await listBookings(db, PROJECT);
        expect(stored.status).toBe("confirmed");
        expect(stored.held_until).toBeNull();
        expect(stored.deposit_due?.paid_at).toBeTruthy();
        expect(await markAppointmentPaid(db, PROJECT, "cen_nothing")).toBe(false);
    });

    it("lets go of a hold whose deposit never came", async () => {
        const { db } = fakeDb([scheduleRow({ ...DEFAULT_SETTINGS, services: [braids], reminders: false })]);
        await bookAppointment({ db, projectId: PROJECT, agentId: "agent", surface: "conversation", conversationId: null }, { service: "braids", start, name: "Tolu", phone: null, note: null });
        const later = Date.now() + 31 * 60_000;
        expect(await sweepSchedules(db, later)).toEqual({ released: 1, reminded: 0, skipped: 0 });
        expect((await listBookings(db, PROJECT))[0].status).toBe("cancelled");
    });
});

describe("reminderDue", () => {
    const base = { id: "b", agent_id: "a", conversation_id: null, title: "t", start: null, detail: null, status: "confirmed" as const, starts_at: "2026-12-01T09:00:00Z", created_at: "2026-11-25T09:00:00Z" };
    const t = (iso: string) => Date.parse(iso);
    it("sends the day-before one within the last day, then the two-hour one", () => {
        expect(reminderDue(base, t("2026-11-30T08:00:00Z"))).toBeNull();
        expect(reminderDue(base, t("2026-11-30T10:00:00Z"))).toBe("day_before");
        expect(reminderDue({ ...base, reminders: { day_before: "x" } }, t("2026-12-01T06:45:00Z"))).toBe("two_hours");
        expect(reminderDue({ ...base, reminders: { day_before: "x", two_hours: "y" } }, t("2026-12-01T07:00:00Z"))).toBeNull();
    });
    it("skips the day-before one for something booked the same day, and nothing at the last minute", () => {
        const sameDay = { ...base, created_at: "2026-12-01T01:00:00Z" };
        expect(reminderDue(sameDay, t("2026-12-01T02:00:00Z"))).toBeNull();
        expect(reminderDue(sameDay, t("2026-12-01T06:45:00Z"))).toBe("two_hours");
        expect(reminderDue(base, t("2026-12-01T08:45:00Z"))).toBeNull();
    });
    it("only for confirmed appointments", () => {
        expect(reminderDue({ ...base, status: "held" }, t("2026-11-30T10:00:00Z"))).toBeNull();
    });
});
