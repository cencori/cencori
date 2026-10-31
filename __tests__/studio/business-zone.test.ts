import { beforeEach, describe, expect, it, vi } from "vitest";
import { utcOffset, zoneCity, zonedInstant } from "@/lib/studio/time";

describe("zone helpers", () => {
    it("turns a wall-clock time in a zone into the right instant, daylight saving included", () => {
        expect(zonedInstant("Africa/Lagos", 2026, 12, 20, 20, 0).toISOString()).toBe("2026-12-20T19:00:00.000Z");
        // London: GMT in December, BST in July.
        expect(zonedInstant("Europe/London", 2026, 12, 20, 20, 0).toISOString()).toBe("2026-12-20T20:00:00.000Z");
        expect(zonedInstant("Europe/London", 2026, 7, 4, 20, 0).toISOString()).toBe("2026-07-04T19:00:00.000Z");
        expect(zonedInstant("America/New_York", 2026, 11, 2, 9, 30).toISOString()).toBe("2026-11-02T14:30:00.000Z");
    });

    it("names offsets and cities the way people do", () => {
        expect(utcOffset("Africa/Lagos", new Date("2026-10-31T08:00:00Z"))).toBe("+01:00");
        expect(utcOffset("America/New_York", new Date("2026-12-01T12:00:00Z"))).toBe("-05:00");
        expect(utcOffset("Asia/Kolkata", new Date("2026-12-01T12:00:00Z"))).toBe("+05:30");
        expect(zoneCity("America/New_York")).toBe("New York");
        expect(zoneCity("UTC")).toBe("UTC");
    });
});

type Row = { id: string; project_id: string; connector_slug: string; created_at: string; metadata: Record<string, unknown> };
let rows: Row[];
let agents: Array<{ id: string; project_id: string; created_at: string }>;

function fakeAdmin() {
    return {
        from(table: string) {
            const filters: Array<[string, unknown]> = [];
            let update: Record<string, unknown> | null = null;
            let insert: Row | null = null;
            const source = () => (table === "agents" ? agents : rows) as Array<Record<string, unknown>>;
            const field = (row: Record<string, unknown>, key: string) => (key.startsWith("metadata->>") ? (row.metadata as Record<string, unknown>)[key.slice(11)] : row[key]);
            const matching = () => source().filter((row) => filters.every(([key, value]) => field(row, key) === value));
            const builder = {
                select: () => builder,
                eq: (key: string, value: unknown) => { filters.push([key, value]); return builder; },
                order: () => builder,
                limit: () => builder,
                update: (patch: Record<string, unknown>) => { update = patch; return builder; },
                insert: (row: Omit<Row, "id" | "created_at">) => { insert = { id: `r${rows.length + 1}`, created_at: String(rows.length + 1), ...row }; rows.push(insert); return builder; },
                single: async () => {
                    if (update) for (const row of matching()) Object.assign(row, update);
                    return { data: insert ?? matching()[0] ?? null, error: null };
                },
                maybeSingle: async () => ({ data: matching()[0] ?? null, error: null }),
                then: (resolve: (value: { data: unknown; error: null }) => void) => {
                    if (update) for (const row of matching()) Object.assign(row, update);
                    resolve({ data: matching(), error: null });
                },
            };
            return builder;
        },
    };
}

const alertsRow = (id: string, agent: string, settings: Record<string, unknown> = {}): Row => ({
    id, project_id: "p", connector_slug: "owner-alerts", created_at: id,
    metadata: { kind: "owner_alerts", agent_id: agent, emails: [], bookings: true, callbacks: true, daily_summary: true, time_zone: "Africa/Lagos", last_summary_for: null, log: [], ...settings },
});

const { adoptTimeZone, businessTimeZone } = await import("@/lib/studio/business-zone");
const { saveOwnerAlerts, getOwnerAlerts } = await import("@/lib/embedded/owner-alerts");

beforeEach(() => {
    vi.useRealTimers();
    rows = [alertsRow("r1", "a1"), alertsRow("r2", "a2")];
    agents = [{ id: "a1", project_id: "p", created_at: "1" }, { id: "a2", project_id: "p", created_at: "2" }];
});

describe("adoptTimeZone", () => {
    it("gives a business nobody chose a zone for the owner's, on every employee, once", async () => {
        const db = fakeAdmin() as never;
        expect(await adoptTimeZone(db, "p", "Europe/London")).toEqual({ time_zone: "Europe/London", adopted: true });
        expect(rows.map((row) => [row.metadata.time_zone, row.metadata.time_zone_source])).toEqual([["Europe/London", "device"], ["Europe/London", "device"]]);
        // Travelling later doesn't move the business.
        expect(await adoptTimeZone(db, "p", "America/New_York")).toEqual({ time_zone: "Europe/London", adopted: false });
        expect(await businessTimeZone(db, "p")).toBe("Europe/London");
    });

    it("never overwrites a zone the owner chose, and ignores nonsense", async () => {
        rows[1].metadata.time_zone = "Africa/Nairobi";
        rows[1].metadata.time_zone_source = "owner";
        const db = fakeAdmin() as never;
        expect(await adoptTimeZone(db, "p", "Europe/London")).toEqual({ time_zone: "Africa/Nairobi", adopted: false });
        rows = [alertsRow("r1", "a1")];
        expect(await adoptTimeZone(fakeAdmin() as never, "p2", "Not/AZone")).toMatchObject({ adopted: false });
    });

    it("keeps the zone where Studio reads it when there are no alerts yet", async () => {
        rows = [];
        const db = fakeAdmin() as never;
        expect(await adoptTimeZone(db, "p", "Asia/Dubai")).toEqual({ time_zone: "Asia/Dubai", adopted: true });
        expect(rows).toHaveLength(1);
        expect(rows[0].metadata).toMatchObject({ agent_id: "a1", time_zone: "Asia/Dubai", time_zone_source: "device", emails: [] });
    });
});

describe("saveOwnerAlerts and the zone", () => {
    it("saving alerts with the zone unchanged isn't a choice; a new zone is, for the whole business", async () => {
        const db = fakeAdmin() as never;
        const existing = await getOwnerAlerts(db, "p", "a1");
        await saveOwnerAlerts(db, { projectId: "p", agentId: "a1", existing, emails: ["a@b.co"], timeZone: "Africa/Lagos" });
        expect(rows[0].metadata.time_zone_source).toBeUndefined();
        await saveOwnerAlerts(db, { projectId: "p", agentId: "a1", existing: await getOwnerAlerts(db, "p", "a1"), emails: ["a@b.co"], timeZone: "Africa/Accra" });
        expect(rows.map((row) => [row.metadata.time_zone, row.metadata.time_zone_source])).toEqual([["Africa/Accra", "owner"], ["Africa/Accra", "owner"]]);
    });
});
