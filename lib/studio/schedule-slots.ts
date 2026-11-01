/**
 * The appointment book's arithmetic, with no database: a business's services,
 * opening hours and how many clients it serves at once (chairs), and from
 * those, which start times are free on a day. Times are the business's own
 * wall clock (lib/studio/time.ts), so "2pm" is 2pm in the salon.
 */

import { localDate, zonedInstant } from "@/lib/studio/time";

export interface Service {
    id: string;
    name: string;
    /** How long it takes, so a 4-hour braid blocks a chair for 4 hours. */
    minutes: number;
    /** Its price, when the business gave one; quoted to customers. */
    price: number | null;
    /** A deposit for this service instead of the business's usual one. */
    deposit?: number | null;
}

/** One day's opening hours, "09:00" to "18:00"; null when closed. */
export type DayHours = { open: string; close: string } | null;

export type DepositRule = { kind: "none" } | { kind: "fixed"; amount: number } | { kind: "percent"; percent: number };

export interface ScheduleSettings {
    services: Service[];
    /** Sunday first, as Date.getDay() counts. */
    hours: DayHours[];
    /** How many clients can be in at the same time (chairs, stylists, rooms). */
    chairs: number;
    deposit: DepositRule;
    /** How long a slot waits for its deposit before it's free again. */
    hold_minutes: number;
    /** Time kept clear after each appointment (cleaning up, a break). */
    buffer_minutes: number;
    /** The earliest a customer can book, from now. */
    lead_minutes: number;
    /** How far ahead they can book. */
    days_ahead: number;
    /** WhatsApp reminders the day before and two hours before. */
    reminders: boolean;
}

export const DEFAULT_SETTINGS: ScheduleSettings = {
    services: [],
    hours: [null, ...Array.from({ length: 6 }, () => ({ open: "09:00", close: "18:00" }))],
    chairs: 1,
    deposit: { kind: "none" },
    hold_minutes: 30,
    buffer_minutes: 0,
    lead_minutes: 60,
    days_ahead: 60,
    reminders: true,
};

/** Start times are offered every this many minutes. */
export const SLOT_STEP_MINUTES = 30;
export const SERVICES_MAX = 60;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** An appointment as far as the book is concerned: when it is and whether it still takes a chair. */
export interface Occupied {
    status: string;
    starts_at?: string | null;
    ends_at?: string | null;
    held_until?: string | null;
}

/** "09:00" → 540. */
export function minutesOf(clock: string): number | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(clock.trim());
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 24 || minutes > 59 || hours * 60 + minutes > 24 * 60) return null;
    return hours * 60 + minutes;
}

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
};
const text = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");
const money = (value: unknown): number | null => {
    const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value.replace(/[^\d.]/g, "")) : Number.NaN;
    return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null;
};

export const newServiceId = () => `s_${Math.random().toString(36).slice(2, 10)}`;

/** One service as sent, checked; or what's wrong with it. */
export function cleanService(input: Record<string, unknown>): { ok: true; service: Service } | { ok: false; message: string } {
    const name = text(input.name, 80);
    if (name.length < 2) return { ok: false, message: "Give the service a name." };
    const minutes = clamp(input.minutes, 0, 24 * 60, 0);
    if (minutes < 5) return { ok: false, message: `How long does ${name} take?` };
    const deposit = money(input.deposit);
    return {
        ok: true,
        service: {
            id: typeof input.id === "string" && /^s_[a-z0-9]{4,12}$/.test(input.id) ? input.id : newServiceId(),
            name,
            minutes,
            price: money(input.price),
            ...(deposit !== null ? { deposit } : {}),
        },
    };
}

/** Settings as stored or sent, made whole: anything missing or broken takes the default. */
export function readSettings(raw: unknown): ScheduleSettings {
    const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const services = (Array.isArray(input.services) ? input.services : [])
        .map((item) => (item && typeof item === "object" ? cleanService(item as Record<string, unknown>) : null))
        .flatMap((result) => (result?.ok ? [result.service] : []))
        .slice(0, SERVICES_MAX);
    const hours = Array.isArray(input.hours) && input.hours.length === 7
        ? input.hours.map((day): DayHours => {
            const open = day && typeof day === "object" ? minutesOf(String((day as { open?: unknown }).open ?? "")) : null;
            const close = day && typeof day === "object" ? minutesOf(String((day as { close?: unknown }).close ?? "")) : null;
            return open !== null && close !== null && close > open ? { open: clock(open), close: clock(close) } : null;
        })
        : DEFAULT_SETTINGS.hours;
    const deposit = input.deposit as { kind?: unknown; amount?: unknown; percent?: unknown } | undefined;
    const rule: DepositRule = deposit?.kind === "fixed" && (money(deposit.amount) ?? 0) > 0
        ? { kind: "fixed", amount: money(deposit.amount)! }
        : deposit?.kind === "percent" && clamp(deposit.percent, 0, 100, 0) > 0
            ? { kind: "percent", percent: clamp(deposit.percent, 1, 100, 50) }
            : { kind: "none" };
    return {
        services,
        hours,
        chairs: clamp(input.chairs, 1, 50, DEFAULT_SETTINGS.chairs),
        deposit: rule,
        hold_minutes: clamp(input.hold_minutes, 10, 24 * 60, DEFAULT_SETTINGS.hold_minutes),
        buffer_minutes: clamp(input.buffer_minutes, 0, 120, DEFAULT_SETTINGS.buffer_minutes),
        lead_minutes: clamp(input.lead_minutes, 0, 7 * 24 * 60, DEFAULT_SETTINGS.lead_minutes),
        days_ahead: clamp(input.days_ahead, 1, 365, DEFAULT_SETTINGS.days_ahead),
        reminders: typeof input.reminders === "boolean" ? input.reminders : DEFAULT_SETTINGS.reminders,
    };
}

/** 540 → "09:00". */
export function clock(minutes: number): string {
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** The deposit a service needs, in the business's currency; 0 for none. */
export function depositFor(settings: ScheduleSettings, service: Service): number {
    if (typeof service.deposit === "number") return service.deposit;
    if (settings.deposit.kind === "fixed") return settings.deposit.amount;
    if (settings.deposit.kind === "percent" && service.price) return Math.round(service.price * settings.deposit.percent / 100);
    return 0;
}

/** Whether an appointment still takes a chair at `now`: confirmed, or held and its hold hasn't run out. */
export function occupies(appointment: Occupied, now: number): boolean {
    if (!appointment.starts_at || !appointment.ends_at) return false;
    if (appointment.status === "confirmed") return true;
    // A hold with no end is waiting on the owner to confirm a transfer the customer says they sent.
    return appointment.status === "held" && (!appointment.held_until || Date.parse(appointment.held_until) > now);
}

/** How many appointments overlap [start, end), each counted with the buffer after it. */
function overlapping(appointments: Occupied[], start: number, end: number, bufferMs: number, now: number): number {
    let count = 0;
    for (const appointment of appointments) {
        if (!occupies(appointment, now)) continue;
        const from = Date.parse(appointment.starts_at!);
        const to = Date.parse(appointment.ends_at!) + bufferMs;
        if (from < end + bufferMs && to > start) count++;
    }
    return count;
}

export type CalendarDay = { year: number; month: number; day: number };

/**
 * Why a start time can't be booked, or null when it can. `byOwner`: the owner
 * booking someone in themselves, who may book outside hours or at short
 * notice; only a full house stops them.
 */
export function slotProblem(opts: { settings: ScheduleSettings; service: Service; start: Date; timeZone: string; appointments: Occupied[]; now?: Date; ignoreId?: string; byOwner?: boolean }): string | null {
    const { settings, service, start, timeZone } = opts;
    const now = (opts.now ?? new Date()).getTime();
    const begins = start.getTime();
    const ends = begins + service.minutes * 60_000;
    const others = opts.ignoreId ? (opts.appointments as Array<Occupied & { id?: string }>).filter((item) => item.id !== opts.ignoreId) : opts.appointments;
    const full = overlapping(others, begins, ends, settings.buffer_minutes * 60_000, now) >= settings.chairs;
    if (opts.byOwner) return full ? `Every chair is taken then (${settings.chairs} at a time).` : null;
    if (begins < now + settings.lead_minutes * 60_000) return settings.lead_minutes ? `That's too soon: bookings need at least ${describeMinutes(settings.lead_minutes)} notice.` : "That time has passed.";
    if (begins > now + settings.days_ahead * 86_400_000) return `Bookings open up to ${settings.days_ahead} days ahead.`;
    const day = localDate(timeZone, start);
    const hours = settings.hours[day.weekday];
    if (!hours) return `The business is closed on ${DAY_NAMES[day.weekday]}s.`;
    const open = zonedInstant(timeZone, day.year, day.month, day.day, ...split(hours.open)).getTime();
    const close = zonedInstant(timeZone, day.year, day.month, day.day, ...split(hours.close)).getTime();
    if (begins < open || ends > close) return `That's outside opening hours (${twelveHour(hours.open)} to ${twelveHour(hours.close)} on ${DAY_NAMES[day.weekday]}s), for something that takes ${describeMinutes(service.minutes)}.`;
    return full ? "That time is taken." : null;
}

const split = (value: string): [number, number] => {
    const minutes = minutesOf(value) ?? 0;
    return [Math.floor(minutes / 60), minutes % 60];
};

/** The free start times for a service on a day, in order. */
export function freeSlots(opts: { settings: ScheduleSettings; service: Service; day: CalendarDay; timeZone: string; appointments: Occupied[]; now?: Date }): Date[] {
    const { settings, service, day, timeZone } = opts;
    const weekday = new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay();
    const hours = settings.hours[weekday];
    if (!hours) return [];
    const open = minutesOf(hours.open)!;
    const close = minutesOf(hours.close)!;
    const slots: Date[] = [];
    for (let at = open; at + service.minutes <= close; at += SLOT_STEP_MINUTES) {
        const start = zonedInstant(timeZone, day.year, day.month, day.day, Math.floor(at / 60), at % 60);
        if (!slotProblem({ ...opts, start })) slots.push(start);
    }
    return slots;
}

/** The next `count` calendar days from `from`, in the business's zone. */
export function nextDays(timeZone: string, from: Date, count: number): CalendarDay[] {
    const today = localDate(timeZone, from);
    return Array.from({ length: count }, (_, index) => {
        const date = new Date(Date.UTC(today.year, today.month - 1, today.day + index));
        return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
    });
}

/** "2pm", "9:30am". */
export function twelveHour(value: string): string {
    const minutes = minutesOf(value) ?? 0;
    const hours = Math.floor(minutes / 60) % 24;
    const rest = minutes % 60;
    return `${hours % 12 || 12}${rest ? `:${String(rest).padStart(2, "0")}` : ""}${hours < 12 ? "am" : "pm"}`;
}

/** "45 minutes", "4 hours", "1 hour 30 minutes". */
export function describeMinutes(total: number): string {
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    return [hours ? `${hours} hour${hours === 1 ? "" : "s"}` : "", minutes ? `${minutes} minutes` : ""].filter(Boolean).join(" ") || "0 minutes";
}

/** The wall-clock time of an instant in the zone, "14:30". */
export function wallClock(timeZone: string, at: Date): string {
    return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
}

/** "Tuesday 3 November at 2pm", in the business's zone. */
export function describeStart(timeZone: string, at: Date): string {
    const day = at.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone });
    return `${day} at ${twelveHour(wallClock(timeZone, at))}`;
}

/**
 * Free start times as people say them: runs of back-to-back slots become
 * "9am to 1pm", the rest are listed. "9am to 11:30am, 2pm, 4pm".
 */
export function describeSlots(timeZone: string, slots: Date[]): string {
    const runs: Array<[Date, Date]> = [];
    for (const slot of slots) {
        const last = runs.at(-1);
        if (last && slot.getTime() - last[1].getTime() === SLOT_STEP_MINUTES * 60_000) last[1] = slot;
        else runs.push([slot, slot]);
    }
    return runs.map(([from, to]) => {
        const start = twelveHour(wallClock(timeZone, from));
        return from === to ? start : `any time from ${start} to ${twelveHour(wallClock(timeZone, to))}`;
    }).join(", ");
}

/**
 * The start the employee asked for, as an instant. A time with no offset
 * ("2026-11-03T14:00") is the business's wall clock; one with Z or an offset
 * is taken as given.
 */
export function parseStart(value: unknown, timeZone: string): Date | null {
    if (typeof value !== "string") return null;
    const raw = value.trim();
    const local = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(raw);
    if (local) {
        const [, year, month, day, hour, minute] = local.map(Number);
        if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
        return zonedInstant(timeZone, year, month, day, hour, minute);
    }
    if (!/^\d{4}-\d{2}-\d{2}T\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(raw)) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** "2026-11-03" → that calendar day. */
export function parseDay(value: unknown): CalendarDay | null {
    if (typeof value !== "string") return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) return null;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const check = new Date(Date.UTC(year, month - 1, day));
    return check.getUTCMonth() === month - 1 && check.getUTCDate() === day ? { year, month, day } : null;
}

/** Find a service by what the customer or employee called it. */
export function findService(services: Service[], wanted: unknown): Service | null {
    const name = typeof wanted === "string" ? wanted.trim().toLowerCase() : "";
    if (!name) return null;
    return services.find((service) => service.id === wanted)
        ?? services.find((service) => service.name.toLowerCase() === name)
        ?? services.find((service) => service.name.toLowerCase().includes(name) || name.includes(service.name.toLowerCase()))
        ?? null;
}

/** The opening hours, as people read them: "Monday to Saturday 9am to 6pm; closed Sunday". */
export function describeHours(hours: DayHours[]): string {
    const order = [1, 2, 3, 4, 5, 6, 0];
    const groups: Array<{ days: number[]; hours: DayHours }> = [];
    for (const weekday of order) {
        const day = hours[weekday];
        const last = groups.at(-1);
        if (last && JSON.stringify(last.hours) === JSON.stringify(day)) last.days.push(weekday);
        else groups.push({ days: [weekday], hours: day });
    }
    return groups.map(({ days, hours: day }) => {
        const names = days.length > 2 ? `${DAY_NAMES[days[0]]} to ${DAY_NAMES[days.at(-1)!]}` : days.map((weekday) => DAY_NAMES[weekday]).join(" and ");
        return day ? `${names} ${twelveHour(day.open)} to ${twelveHour(day.close)}` : `closed ${names}`;
    }).join("; ");
}
