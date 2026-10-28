import "server-only";

import OpenAI from "openai";
import type { createAdminClient } from "@/lib/supabaseAdmin";
import { getCatalog } from "@/lib/embedded/catalog";
import { listBookings } from "@/lib/embedded/bookings";
import { pushToOwners } from "@/lib/studio/push";
import { earnedSince, paidThroughAssistant } from "@/lib/studio/earned";
import { localDate, localMidnight, safeTimeZone } from "@/lib/studio/time";
import { needsOwner, withoutCatchUpNote } from "@/lib/studio/takeover";
import { OWNER_ALERTS_SLUG, localDateHour, SUMMARY_HOUR } from "@/lib/embedded/owner-alerts";

/**
 * The morning brief: at 8am the business's time, a push notification and a
 * card on Studio's Home saying what happened yesterday and what to do about
 * it. "₦480k yesterday. 3 people asked for suya, you don't sell it."
 *
 * The numbers are counted here; DeepSeek Flash only turns them, and
 * yesterday's customer messages, into a few short lines (a plain template
 * when it can't). A quiet day sends nothing.
 *
 * Kept per project on `tool_connections` (connector_slug 'studio_brief'):
 * the last two weeks of briefs, and the local date the last one covered.
 * Runs from the hourly owner-alerts job.
 */

type Admin = ReturnType<typeof createAdminClient>;

export const BRIEF_SLUG = "studio_brief";
const KEEP = 14;
/** Briefs written per hourly run; the rest wait for the next hour. */
const PER_RUN = 150;
const MESSAGES_MAX = 60;

export interface MorningBrief {
    /** The local date the brief covers (yesterday, when it was written). */
    for: string;
    at: string;
    headline: string;
    points: string[];
}

export interface BriefFacts {
    business: string;
    currency: string;
    chats: number;
    earned: number;
    payments: number;
    /** The same weekday a week before, to compare. */
    earnedWeekBefore: number;
    orders: number;
    topItems: Array<{ name: string; quantity: number }>;
    bookingsMade: number;
    bookingsToday: number;
    waitingForOwner: number;
    products: string[];
    /** What customers wrote yesterday, shortened, each with its chat ("chat 2: ..."). */
    messages: string[];
}

function money(amount: number, currency: string): string {
    if (currency !== "NGN") return `${currency} ${Math.round(amount).toLocaleString("en-NG")}`;
    if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}m`;
    if (amount >= 10_000) return `₦${Math.round(amount / 1_000)}k`;
    return `₦${Math.round(amount).toLocaleString("en-NG")}`;
}

function dateKey(parts: { year: number; month: number; day: number }): string {
    return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/** Yesterday and today in the business's zone, as local midnights. */
function days(timeZone: string, now: Date) {
    const today = localDate(timeZone, now);
    const todayStart = localMidnight(timeZone, today.year, today.month, today.day);
    const yesterday = localDate(timeZone, new Date(todayStart.getTime() - 12 * 3_600_000));
    const yesterdayStart = localMidnight(timeZone, yesterday.year, yesterday.month, yesterday.day);
    const weekBefore = localDate(timeZone, new Date(yesterdayStart.getTime() - 6.5 * 86_400_000));
    const weekBeforeStart = localMidnight(timeZone, weekBefore.year, weekBefore.month, weekBefore.day);
    return { today: dateKey(today), yesterday: dateKey(yesterday), todayStart, yesterdayStart, weekBeforeStart, weekBeforeEnd: new Date(weekBeforeStart.getTime() + (todayStart.getTime() - yesterdayStart.getTime())) };
}

export async function briefFacts(db: Admin, projectId: string, business: string, timeZone: string, now = new Date()): Promise<BriefFacts> {
    const d = days(timeZone, now);
    const inYesterday = (iso: string | null | undefined) => !!iso && Date.parse(iso) >= d.yesterdayStart.getTime() && Date.parse(iso) < d.todayStart.getTime();

    const [money_, catalog, bookings, { data: sessions }] = await Promise.all([
        paidThroughAssistant(db, projectId),
        getCatalog(db, projectId).catch(() => null),
        listBookings(db, projectId).catch(() => []),
        // Customer chats active yesterday (or still open), never console previews.
        db.from("sessions").select("id, created_at, status, metadata, last_turn_number")
            .eq("project_id", projectId).gte("updated_at", d.yesterdayStart.toISOString())
            .or("metadata->>preview.is.null,metadata->>preview.eq.false")
            .order("updated_at", { ascending: false }).limit(300),
    ]);

    const rows = (sessions ?? []) as Array<{ id: string; created_at: string; status: string; metadata: Record<string, unknown> | null; last_turn_number: number | null }>;
    const talked = rows.filter((row) => (row.last_turn_number ?? 0) > 0);
    const chats = talked.filter((row) => inYesterday(row.created_at)).length;
    const waitingForOwner = rows.filter((row) => row.status === "active" && needsOwner(row.metadata)).length;

    // What customers wrote yesterday: the start of each turn.
    let messages: string[] = [];
    if (talked.length) {
        const { data: events } = await db.from("session_events").select("session_id, created_at, input:payload->>input_text")
            .in("session_id", talked.slice(0, 150).map((row) => row.id)).eq("event_type", "turn.started")
            .gte("created_at", d.yesterdayStart.toISOString()).lt("created_at", d.todayStart.toISOString())
            .order("created_at", { ascending: true }).limit(MESSAGES_MAX);
        // Numbered by chat, so one customer's three messages read as one person.
        const chatNumber = new Map<string, number>();
        messages = ((events ?? []) as Array<{ session_id: string; input: string | null }>).flatMap((event) => {
            const text = (event.input ? withoutCatchUpNote(event.input) : "").replace(/\s+/g, " ").trim().slice(0, 160);
            if (!text) return [];
            if (!chatNumber.has(event.session_id)) chatNumber.set(event.session_id, chatNumber.size + 1);
            return [`chat ${chatNumber.get(event.session_id)}: ${text}`];
        });
    }

    const earned = earnedSince(money_.paid.filter((entry) => inYesterday(entry.at)), d.yesterdayStart);
    const weekBefore = money_.paid.filter((entry) => Date.parse(entry.at) >= d.weekBeforeStart.getTime() && Date.parse(entry.at) < d.weekBeforeEnd.getTime());
    const orders = (catalog?.metadata.orders ?? []).filter((order) => inYesterday(order.created_at) && order.status !== "cancelled");
    const counts = new Map<string, number>();
    for (const order of orders) for (const item of order.items) counts.set(item.name, (counts.get(item.name) ?? 0) + item.quantity);

    return {
        business,
        currency: money_.currency,
        chats,
        earned: earned.amount,
        payments: earned.count,
        earnedWeekBefore: weekBefore.reduce((sum, entry) => sum + entry.amount, 0),
        orders: orders.length,
        topItems: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, quantity]) => ({ name, quantity })),
        bookingsMade: bookings.filter((booking) => inYesterday(booking.created_at) && booking.status !== "cancelled").length,
        bookingsToday: bookings.filter((booking) => booking.status === "confirmed" && !!booking.start && booking.start.slice(0, 10) === d.today).length,
        waitingForOwner,
        products: (catalog?.metadata.products ?? []).slice(0, 60).map((product) => product.name),
        messages,
    };
}

/** Nothing happened and nothing's waiting: no brief. */
export function quietDay(facts: BriefFacts): boolean {
    return facts.chats === 0 && facts.earned === 0 && facts.orders === 0 && facts.bookingsToday === 0 && facts.waitingForOwner === 0;
}

/** The brief without the model: the numbers, plainly. */
export function plainBrief(facts: BriefFacts): Pick<MorningBrief, "headline" | "points"> {
    const headline = facts.earned > 0
        ? `${money(facts.earned, facts.currency)} yesterday`
        : `${facts.chats} chat${facts.chats === 1 ? "" : "s"} yesterday`;
    const points = [
        facts.earned > 0 && facts.chats > 0 ? `${facts.chats} chat${facts.chats === 1 ? "" : "s"}, ${facts.payments} payment${facts.payments === 1 ? "" : "s"}.` : null,
        facts.topItems.length ? `Top seller: ${facts.topItems[0].name} (${facts.topItems[0].quantity}).` : null,
        facts.bookingsToday ? `${facts.bookingsToday} booking${facts.bookingsToday === 1 ? "" : "s"} today.` : null,
        facts.waitingForOwner ? `${facts.waitingForOwner} customer${facts.waitingForOwner === 1 ? " is" : "s are"} waiting for you.` : null,
    ].filter((point): point is string => !!point);
    return { headline, points: points.slice(0, 3) };
}

const PROMPT = `You write a business owner's morning brief: what happened yesterday and what to do today. The owner runs a small business in Nigeria and reads this on their phone.

Rules:
- Use only the facts given. Never invent numbers, products or customers.
- Only write numbers that appear in the facts. Never count the messages yourself: say "Customers asked for asun", not "4 people asked for asun".
- "messages" are what customers wrote, labelled by chat; several lines from one chat are one person.
- Mention customers waiting for a reply only when waitingForOwner is above 0.
- Leave out anything that didn't happen ("no orders", "no one is waiting"): fewer points is better than filler.
- "headline": under 40 characters, the most important thing, usually money ("₦480k yesterday").
- "points": 1 to 3 short lines, each under 90 characters, none repeating the headline. Prefer things the owner can act on: something customers asked for that isn't on the product list, a question customers keep asking, an item that sold well or sold out, bookings today, customers waiting for a reply.
- Plain words, no greetings, no emojis, no exclamation marks. Write money like ₦12,500 or ₦480k.
- Reply with JSON only: {"headline": "...", "points": ["..."]}`;

/** The brief, written by DeepSeek Flash from the facts; the plain one if that fails. */
export async function writeBrief(facts: BriefFacts): Promise<Pick<MorningBrief, "headline" | "points">> {
    const plain = plainBrief(facts);
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return plain;
    try {
        const client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com", timeout: 20_000, maxRetries: 1 });
        const completion = await client.chat.completions.create({
            model: "deepseek-flash",
            temperature: 0,
            max_tokens: 300,
            response_format: { type: "json_object" },
            reasoning_effort: "none" as OpenAI.ReasoningEffort,
            messages: [
                { role: "system", content: PROMPT },
                { role: "user", content: JSON.stringify({ ...facts, earned: money(facts.earned, facts.currency), earnedWeekBefore: money(facts.earnedWeekBefore, facts.currency) }) },
            ],
        });
        const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as { headline?: unknown; points?: unknown };
        const headline = typeof parsed.headline === "string" ? parsed.headline.trim().slice(0, 60) : "";
        const points = Array.isArray(parsed.points) ? parsed.points.filter((p): p is string => typeof p === "string" && !!p.trim()).map((p) => p.trim().slice(0, 140)).slice(0, 3) : [];
        return headline && points.length ? { headline, points } : plain;
    } catch (error) {
        console.error("[brief] model failed, sending the plain brief", error instanceof Error ? error.message : error);
        return plain;
    }
}

/** The brief as it's read aloud: money said in words a voice reads well. */
export function briefScript(brief: Pick<MorningBrief, "headline" | "points">): string {
    const spoken = (text: string) => text
        .replace(/₦\s?([\d.,]+)\s?m\b/gi, (_, n: string) => `${n} million naira`)
        .replace(/₦\s?([\d.,]+)\s?k\b/gi, (_, n: string) => `${n} thousand naira`)
        .replace(/₦\s?([\d,]+(?:\.\d+)?)/g, (_, n: string) => `${n} naira`);
    const sentence = (text: string) => (/[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);
    return ["Good morning.", sentence(spoken(brief.headline)), ...brief.points.map((point) => sentence(spoken(point)))].join(" ");
}

type BriefRow = { id: string; metadata: { kind: "studio_brief"; last_for: string | null; briefs: MorningBrief[] } };

async function briefRow(db: Admin, projectId: string): Promise<BriefRow | null> {
    const { data } = await db.from("tool_connections").select("id, metadata").eq("project_id", projectId).eq("connector_slug", BRIEF_SLUG).limit(1).maybeSingle();
    const metadata = data?.metadata as BriefRow["metadata"] | undefined;
    if (!data || metadata?.kind !== "studio_brief") return null;
    return { id: data.id as string, metadata: { ...metadata, briefs: Array.isArray(metadata.briefs) ? metadata.briefs : [] } };
}

/** This morning's brief, if there is one (the one covering yesterday). */
export async function latestBrief(db: Admin, projectId: string, timeZone: string, now = new Date()): Promise<MorningBrief | null> {
    const row = await briefRow(db, projectId);
    const brief = row?.metadata.briefs.at(-1);
    return brief && brief.for === days(timeZone, now).yesterday ? brief : null;
}

async function saveBrief(db: Admin, projectId: string, row: BriefRow | null, lastFor: string, brief: MorningBrief | null): Promise<void> {
    const metadata = { kind: "studio_brief" as const, last_for: lastFor, briefs: [...(row?.metadata.briefs ?? []), ...(brief ? [brief] : [])].slice(-KEEP) };
    if (row) await db.from("tool_connections").update({ metadata }).eq("id", row.id);
    else await db.from("tool_connections").insert({ project_id: projectId, connector_slug: BRIEF_SLUG, owner_type: "platform", status: "active", metadata });
}

/** Write and send one project's brief now (when it isn't a quiet day). */
export async function sendBrief(db: Admin, projectId: string, business: string, timeZone: string, now = new Date()): Promise<MorningBrief | null> {
    const row = await briefRow(db, projectId);
    const { yesterday } = days(timeZone, now);
    const facts = await briefFacts(db, projectId, business, timeZone, now);
    if (quietDay(facts)) {
        await saveBrief(db, projectId, row, yesterday, null);
        return null;
    }
    const written = await writeBrief(facts);
    const brief: MorningBrief = { for: yesterday, at: now.toISOString(), ...written };
    await saveBrief(db, projectId, row, yesterday, brief);
    await pushToOwners(db, projectId, { title: brief.headline, body: brief.points.join(" "), url: "/", tag: "brief" });
    return brief;
}

/**
 * The hourly job: every business project whose morning it is (8am or later
 * in its zone) and whose brief for yesterday hasn't gone out.
 */
export async function sendMorningBriefs(db: Admin, now = new Date()): Promise<{ sent: number; quiet: number }> {
    // Business projects with a live assistant. Joined, not listed by id, so it
    // stays one short request however many businesses there are.
    const { data: agents } = await db.from("agents")
        .select("project_id, projects!inner(name, organizations!inner(name, account_type))")
        .not("stable_version_id", "is", null)
        .eq("projects.organizations.account_type", "business")
        .limit(10_000);
    const projects = new Map<string, { business: string }>();
    for (const agent of (agents ?? []) as unknown as Array<{ project_id: string; projects: { name: string; organizations: { name: string } } }>) {
        projects.set(agent.project_id, { business: agent.projects.organizations?.name ?? agent.projects.name });
    }
    if (projects.size === 0) return { sent: 0, quiet: 0 };

    const [{ data: alertRows }, { data: briefRows }] = await Promise.all([
        db.from("tool_connections").select("project_id, metadata").eq("connector_slug", OWNER_ALERTS_SLUG).limit(10_000),
        db.from("tool_connections").select("project_id, metadata").eq("connector_slug", BRIEF_SLUG).limit(10_000),
    ]);
    const zones = new Map(((alertRows ?? []) as Array<{ project_id: string; metadata: { time_zone?: string } | null }>).map((row) => [row.project_id, safeTimeZone(row.metadata?.time_zone)]));
    const lastFor = new Map(((briefRows ?? []) as Array<{ project_id: string; metadata: { last_for?: string } | null }>).map((row) => [row.project_id, row.metadata?.last_for ?? null]));

    const due = [...projects.entries()].filter(([projectId]) => {
        const zone = zones.get(projectId) ?? safeTimeZone(null);
        const { hour } = localDateHour(now, zone);
        return hour >= SUMMARY_HOUR && lastFor.get(projectId) !== days(zone, now).yesterday;
    }).slice(0, PER_RUN);

    let sent = 0;
    let quiet = 0;
    // A few at a time: each is a handful of reads and one short model call.
    for (let index = 0; index < due.length; index += 5) {
        await Promise.all(due.slice(index, index + 5).map(async ([projectId, project]) => {
            try {
                const zone = zones.get(projectId) ?? safeTimeZone(null);
                const brief = await sendBrief(db, projectId, project.business, zone, now);
                if (brief) sent++;
                else quiet++;
            } catch (error) {
                console.error("[brief] failed for a project", projectId, error instanceof Error ? error.message : error);
            }
        }));
    }
    return { sent, quiet };
}
