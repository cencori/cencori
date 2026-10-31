"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { CalendarIcon } from "@solar-icons/react/linear/calendar";
import { cn } from "@/lib/utils";

/**
 * Studio's own date and time picker for events (the browser's is grey boxes
 * and blue squares). Works in the same "YYYY-MM-DDTHH:MM" business-time value a
 * datetime-local field gives, so the form around it doesn't change. Opens in
 * place in the sheet, not as a popup.
 */

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MINUTE_STEP = 15;

type Parts = { year: number; month: number; day: number; hour: number; minute: number };

function parse(value: string): Parts | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    const [, year, month, day, hour, minute] = match.map(Number);
    return { year, month, day, hour, minute };
}

const pad = (n: number) => String(n).padStart(2, "0");
const format = (parts: Parts) => `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;

/** Today on the business's clock, so "today" and "past" mean the same on any device. */
function zoneToday(timeZone: string): { year: number; month: number; day: number } {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map((part) => [part.type, part.value]));
    return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

function label(parts: Parts, timeZone: string): string {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    const day = date.toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: parts.year === zoneToday(timeZone).year ? undefined : "numeric" });
    const hour12 = parts.hour % 12 || 12;
    return `${day} · ${hour12}:${pad(parts.minute)} ${parts.hour < 12 ? "am" : "pm"}`;
}

export function EventDateTimePicker({ value, onChange, timeZone }: { value: string; onChange: (value: string) => void; timeZone: string }) {
    const today = zoneToday(timeZone);
    const current = parse(value);
    const [open, setOpen] = useState(false);
    const [view, setView] = useState(() => ({ year: current?.year ?? today.year, month: current?.month ?? today.month }));

    // A new pick keeps the time already chosen, or starts at 8 pm (when most events start).
    const set = (patch: Partial<Parts>) => onChange(format({ ...(current ?? { ...today, hour: 20, minute: 0 }), ...patch }));

    const first = new Date(Date.UTC(view.year, view.month - 1, 1));
    const lead = (first.getUTCDay() + 6) % 7; // Monday first
    const days = new Date(Date.UTC(view.year, view.month, 0)).getUTCDate();
    const cells: Array<number | null> = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
    const isPast = (day: number) => view.year * 10_000 + view.month * 100 + day < today.year * 10_000 + today.month * 100 + today.day;
    const shift = (by: number) => setView(({ year, month }) => {
        const index = year * 12 + (month - 1) + by;
        return { year: Math.floor(index / 12), month: (index % 12) + 1 };
    });
    const canGoBack = view.year * 12 + view.month > today.year * 12 + today.month;

    const hour12 = current ? current.hour % 12 || 12 : 8;
    const pm = current ? current.hour >= 12 : true;
    const setHour12 = (next: number, nextPm = pm) => set({ hour: (next % 12) + (nextPm ? 12 : 0) });
    const minute = current?.minute ?? 0;

    return (
        <div>
            <button type="button" onClick={() => setOpen((was) => !was)} className="flex h-12 w-full items-center gap-3 rounded-full bg-muted px-5 text-left text-[15px]">
                <CalendarIcon size={20} className="shrink-0 text-muted-foreground" />
                <span className={cn("min-w-0 flex-1 truncate", !current && "text-muted-foreground")}>{current ? label(current, timeZone) : "Pick a date and time"}</span>
            </button>

            {open && (
                <div className="mt-2 rounded-3xl bg-muted p-4">
                    <div className="flex items-center justify-between">
                        <button type="button" aria-label="Previous month" disabled={!canGoBack} onClick={() => shift(-1)} className="flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-30"><ChevronLeft className="h-5 w-5" /></button>
                        <span className="text-[15px] font-semibold">{first.toLocaleDateString("en-GB", { timeZone: "UTC", month: "long", year: "numeric" })}</span>
                        <button type="button" aria-label="Next month" onClick={() => shift(1)} className="flex h-9 w-9 items-center justify-center rounded-full"><ChevronRight className="h-5 w-5" /></button>
                    </div>
                    <div className="mt-3 grid grid-cols-7 text-center text-[12px] font-medium text-muted-foreground">
                        {WEEKDAYS.map((day, index) => <span key={index}>{day}</span>)}
                    </div>
                    <div className="mt-1 grid grid-cols-7 gap-y-1">
                        {cells.map((day, index) => {
                            if (day === null) return <span key={`gap-${index}`} />;
                            const chosen = current?.year === view.year && current.month === view.month && current.day === day;
                            const isToday = today.year === view.year && today.month === view.month && today.day === day;
                            return (
                                <button key={day} type="button" disabled={isPast(day)} onClick={() => set({ year: view.year, month: view.month, day })} className={cn("mx-auto flex h-10 w-10 items-center justify-center rounded-full text-[15px] disabled:opacity-25", chosen ? "bg-foreground font-semibold text-background" : isToday && "ring-1 ring-foreground/40")}>
                                    {day}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                        <Stepper label={String(hour12)} onLess={() => setHour12(hour12 === 1 ? 12 : hour12 - 1)} onMore={() => setHour12(hour12 === 12 ? 1 : hour12 + 1)} />
                        <span className="text-[15px] font-semibold">:</span>
                        <Stepper label={pad(minute)} onLess={() => set({ minute: (minute - MINUTE_STEP + 60) % 60 })} onMore={() => set({ minute: (minute + MINUTE_STEP) % 60 })} />
                        <div className="ml-auto flex h-10 rounded-full bg-background p-1">
                            {(["am", "pm"] as const).map((half) => (
                                <button key={half} type="button" onClick={() => setHour12(hour12, half === "pm")} className={cn("w-12 rounded-full text-[14px] font-semibold", (half === "pm") === pm ? "bg-foreground text-background" : "text-muted-foreground")}>
                                    {half.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button type="button" onClick={() => setOpen(false)} className="mt-4 h-11 w-full rounded-full bg-background text-[15px] font-semibold">Done</button>
                </div>
            )}
        </div>
    );
}

function Stepper({ label, onLess, onMore }: { label: string; onLess: () => void; onMore: () => void }) {
    return (
        <div className="flex h-10 items-center rounded-full bg-background px-1">
            <button type="button" aria-label="Less" onClick={onLess} className="flex h-8 w-8 items-center justify-center rounded-full"><Minus className="h-4 w-4" /></button>
            <span className="w-7 text-center text-[15px] font-semibold tabular-nums">{label}</span>
            <button type="button" aria-label="More" onClick={onMore} className="flex h-8 w-8 items-center justify-center rounded-full"><Plus className="h-4 w-4" /></button>
        </div>
    );
}
