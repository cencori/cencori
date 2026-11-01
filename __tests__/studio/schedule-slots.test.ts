import { describe, expect, it } from "vitest";
import {
    DEFAULT_SETTINGS,
    depositFor,
    describeHours,
    describeSlots,
    findService,
    freeSlots,
    occupies,
    parseStart,
    readSettings,
    slotProblem,
    type ScheduleSettings,
    type Service,
} from "@/lib/studio/schedule-slots";

const LAGOS = "Africa/Lagos";
const braids: Service = { id: "s_braids1", name: "Knotless braids", minutes: 240, price: 25000 };
const trim: Service = { id: "s_trim0001", name: "Trim", minutes: 30, price: 5000 };
const settings: ScheduleSettings = { ...DEFAULT_SETTINGS, services: [braids, trim], chairs: 1, lead_minutes: 60 };
// Monday 2 November 2026, 7am in Lagos (UTC+1).
const now = new Date("2026-11-02T06:00:00Z");
const at = (local: string) => parseStart(local, LAGOS)!;
const appointment = (start: string, minutes: number, extra: Record<string, unknown> = {}) => ({
    id: start,
    status: "confirmed",
    starts_at: at(start).toISOString(),
    ends_at: new Date(at(start).getTime() + minutes * 60_000).toISOString(),
    ...extra,
});

describe("parseStart", () => {
    it("reads a time with no offset as the business's wall clock", () => {
        expect(parseStart("2026-11-03T14:00", LAGOS)?.toISOString()).toBe("2026-11-03T13:00:00.000Z");
    });
    it("takes a time with an offset as given", () => {
        expect(parseStart("2026-11-03T14:00:00Z", LAGOS)?.toISOString()).toBe("2026-11-03T14:00:00.000Z");
    });
    it("rejects nonsense", () => {
        expect(parseStart("tomorrow at 2", LAGOS)).toBeNull();
        expect(parseStart("2026-13-03T14:00", LAGOS)).toBeNull();
    });
});

describe("freeSlots", () => {
    it("offers every half hour a 4-hour service fits in the day", () => {
        const slots = freeSlots({ settings, service: braids, day: { year: 2026, month: 11, day: 3 }, timeZone: LAGOS, appointments: [], now });
        // 9:00 to 14:00 (the last start that ends by 18:00).
        expect(slots).toHaveLength(11);
        expect(describeSlots(LAGOS, slots)).toBe("any time from 9am to 2pm");
    });

    it("is closed on Sunday", () => {
        expect(freeSlots({ settings, service: trim, day: { year: 2026, month: 11, day: 8 }, timeZone: LAGOS, appointments: [], now })).toEqual([]);
    });

    it("leaves out times that overlap a booking when there's one chair", () => {
        const slots = freeSlots({ settings, service: trim, day: { year: 2026, month: 11, day: 3 }, timeZone: LAGOS, appointments: [appointment("2026-11-03T10:00", 240)], now });
        expect(describeSlots(LAGOS, slots)).toBe("any time from 9am to 9:30am, any time from 2pm to 5:30pm");
    });

    it("lets two clients in at once with two chairs", () => {
        const two = { ...settings, chairs: 2 };
        const slots = freeSlots({ settings: two, service: trim, day: { year: 2026, month: 11, day: 3 }, timeZone: LAGOS, appointments: [appointment("2026-11-03T10:00", 240)], now });
        expect(slots).toHaveLength(18);
    });

    it("keeps the buffer clear after each appointment", () => {
        const buffered = { ...settings, buffer_minutes: 30 };
        const slots = freeSlots({ settings: buffered, service: trim, day: { year: 2026, month: 11, day: 3 }, timeZone: LAGOS, appointments: [appointment("2026-11-03T10:00", 60)], now });
        // 9:00-9:30 and its buffer end at 10:00; after 10:00-11:00 and its buffer, 11:30 is the first.
        expect(describeSlots(LAGOS, slots).startsWith("9am, any time from 11:30am")).toBe(true);
    });

    it("needs the notice: nothing before 8am today when it's 7am", () => {
        const slots = freeSlots({ settings: { ...settings, hours: settings.hours.map(() => ({ open: "07:00", close: "12:00" })) }, service: trim, day: { year: 2026, month: 11, day: 2 }, timeZone: LAGOS, appointments: [], now });
        expect(slots[0].toISOString()).toBe(at("2026-11-02T08:00").toISOString());
    });
});

describe("holds", () => {
    it("a held slot takes the chair until its hold runs out", () => {
        const held = appointment("2026-11-03T10:00", 30, { status: "held", held_until: "2026-11-02T06:30:00Z" });
        expect(occupies(held, now.getTime())).toBe(true);
        expect(occupies(held, Date.parse("2026-11-02T06:31:00Z"))).toBe(false);
    });
    it("a hold waiting on the owner to check a transfer has no end", () => {
        expect(occupies(appointment("2026-11-03T10:00", 30, { status: "held", held_until: null }), now.getTime())).toBe(true);
    });
    it("cancelled appointments free the chair", () => {
        expect(occupies(appointment("2026-11-03T10:00", 30, { status: "cancelled" }), now.getTime())).toBe(false);
    });
});

describe("slotProblem", () => {
    it("says why a time can't be booked", () => {
        expect(slotProblem({ settings, service: braids, start: at("2026-11-03T16:00"), timeZone: LAGOS, appointments: [], now })).toMatch(/outside opening hours/);
        expect(slotProblem({ settings, service: trim, start: at("2026-11-08T10:00"), timeZone: LAGOS, appointments: [], now })).toMatch(/closed on Sundays/);
        expect(slotProblem({ settings, service: trim, start: at("2026-11-02T07:30"), timeZone: LAGOS, appointments: [], now })).toMatch(/too soon/);
        expect(slotProblem({ settings, service: trim, start: at("2026-11-03T10:00"), timeZone: LAGOS, appointments: [appointment("2026-11-03T10:00", 30)], now })).toBe("That time is taken.");
    });
    it("lets the owner book outside hours, but not into a full house", () => {
        expect(slotProblem({ settings, service: trim, start: at("2026-11-08T10:00"), timeZone: LAGOS, appointments: [], now, byOwner: true })).toBeNull();
        expect(slotProblem({ settings, service: trim, start: at("2026-11-03T10:00"), timeZone: LAGOS, appointments: [appointment("2026-11-03T10:00", 30)], now, byOwner: true })).toMatch(/Every chair/);
    });
    it("ignores the appointment being moved", () => {
        expect(slotProblem({ settings, service: trim, start: at("2026-11-03T10:15"), timeZone: LAGOS, appointments: [appointment("2026-11-03T10:00", 30)], now, ignoreId: "2026-11-03T10:00" })).toBeNull();
    });
});

describe("settings", () => {
    it("fills in what's missing and drops what's broken", () => {
        const read = readSettings({ services: [{ name: "Wash", minutes: 45, price: "₦3,000" }, { name: "x" }], chairs: 0, deposit: { kind: "percent", percent: 30 } });
        expect(read.services).toEqual([expect.objectContaining({ name: "Wash", minutes: 45, price: 3000 })]);
        expect(read.chairs).toBe(1);
        expect(read.hours).toEqual(DEFAULT_SETTINGS.hours);
        expect(depositFor(read, read.services[0])).toBe(900);
    });
    it("a service's own deposit wins", () => {
        expect(depositFor({ ...settings, deposit: { kind: "fixed", amount: 2000 } }, { ...braids, deposit: 10000 })).toBe(10000);
        expect(depositFor({ ...settings, deposit: { kind: "fixed", amount: 2000 } }, braids)).toBe(2000);
    });
    it("describes the week as people say it", () => {
        expect(describeHours(DEFAULT_SETTINGS.hours)).toBe("Monday to Saturday 9am to 6pm; closed Sunday");
    });
    it("finds a service by what the customer called it", () => {
        expect(findService(settings.services, "knotless")?.id).toBe("s_braids1");
        expect(findService(settings.services, "TRIM")?.id).toBe("s_trim0001");
        expect(findService(settings.services, "massage")).toBeNull();
    });
});
