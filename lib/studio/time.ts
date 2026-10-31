/**
 * Days, weeks and months in the business's own time zone (its owner-alerts
 * setting, Lagos otherwise), so "today" in Studio is the owner's today.
 */

export const DEFAULT_TIME_ZONE = "Africa/Lagos";

function parts(timeZone: string, at: Date) {
    const map = Object.fromEntries(
        new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
            .formatToParts(at)
            .map((part) => [part.type, part.value]),
    );
    return { year: +map.year, month: +map.month, day: +map.day, hour: +map.hour, minute: +map.minute, second: +map.second };
}

/** How far the zone's clock is ahead of UTC at that moment, in ms. */
function offsetAt(timeZone: string, at: Date): number {
    const p = parts(timeZone, at);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(at.getTime() / 1000) * 1000;
}

/** The UTC instant of local midnight on a local calendar date. */
export function localMidnight(timeZone: string, year: number, month: number, day: number): Date {
    const guess = new Date(Date.UTC(year, month - 1, day));
    return new Date(guess.getTime() - offsetAt(timeZone, guess));
}

/** Local calendar date of an instant. */
export function localDate(timeZone: string, at: Date): { year: number; month: number; day: number; weekday: number } {
    const p = parts(timeZone, at);
    return { year: p.year, month: p.month, day: p.day, weekday: new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() };
}

/** Midnight today and the 1st of this month, as UTC instants. */
export function periodStarts(timeZone: string, now = new Date()): { day: Date; month: Date; year: Date } {
    const today = localDate(timeZone, now);
    return {
        day: localMidnight(timeZone, today.year, today.month, today.day),
        month: localMidnight(timeZone, today.year, today.month, 1),
        year: localMidnight(timeZone, today.year, 1, 1),
    };
}

/** "Africa/Lagos" → "Lagos", "America/New_York" → "New York": how people name a zone. */
export function zoneCity(timeZone: string): string {
    if (timeZone === "UTC" || timeZone === "Etc/UTC") return "UTC";
    return (timeZone.split("/").pop() ?? timeZone).replace(/_/g, " ");
}

/** The instant a wall-clock time in a zone is ("20:00 on 20 Dec in London"), daylight saving included. */
export function zonedInstant(timeZone: string, year: number, month: number, day: number, hour: number, minute: number): Date {
    const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
    const first = new Date(guess.getTime() - offsetAt(timeZone, guess));
    // Once more from the first answer, for the hours either side of a clock change.
    return new Date(guess.getTime() - offsetAt(timeZone, first));
}

/** A zone's offset from UTC at a moment, as in ISO times: "+01:00", "-05:00", "+00:00". */
export function utcOffset(timeZone: string, at = new Date()): string {
    const minutes = Math.round(offsetAt(timeZone, at) / 60_000);
    const sign = minutes < 0 ? "-" : "+";
    const abs = Math.abs(minutes);
    return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** A usable zone: the one given if the runtime knows it, else Lagos. */
export function safeTimeZone(timeZone: string | null | undefined): string {
    if (!timeZone) return DEFAULT_TIME_ZONE;
    try {
        new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
        return timeZone;
    } catch {
        return DEFAULT_TIME_ZONE;
    }
}
