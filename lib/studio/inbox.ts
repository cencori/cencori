import "server-only";

import type { createAdminClient } from "@/lib/supabaseAdmin";
import { isOwnerActive, manualMessages, needsOwner, withoutCatchUpNote, type NeedsOwner } from "@/lib/studio/takeover";

type Admin = ReturnType<typeof createAdminClient>;

export type InboxChannel = "whatsapp" | "website" | "link" | "other";

export interface InboxConversation {
    id: string;
    channel: InboxChannel;
    /** What the owner sees: the customer's WhatsApp name, else their number, else "Website visitor". */
    name: string;
    number: string | null;
    last_message: string | null;
    /** Who sent the last message. */
    last_from: "customer" | "assistant" | "owner" | null;
    updated_at: string;
    open: boolean;
    /** The assistant handed the customer over or asked for a callback. */
    needs_owner: NeedsOwner | null;
    /** The owner has stepped in: the assistant is quiet in this chat. */
    owner_active: boolean;
}

export interface InboxMessage {
    id: string;
    from: "customer" | "assistant" | "owner";
    text: string;
    at: string;
}

/** WhatsApp lets a business send a normal message only within 24 hours of the customer's last one. */
export const REPLY_WINDOW_MS = 24 * 60 * 60_000;

type SessionRow = { id: string; status: string; metadata: Record<string, unknown> | null; external_user_id: string | null; updated_at: string; created_at: string; last_turn_number: number | null };
type EventRow = { session_id: string; turn_number: number; event_type: string; created_at: string; input: string | null; output: unknown };

const SESSION_COLUMNS = "id, status, metadata, external_user_id, updated_at, created_at, last_turn_number";
// Only what the inbox shows: never the instructions or tools a turn carried.
const EVENT_COLUMNS = "session_id, turn_number, event_type, created_at, input:payload->>input_text, output:payload->output->output";

export function channelOf(metadata: Record<string, unknown> | null): InboxChannel {
    const source = metadata?.source;
    if (source === "whatsapp") return "whatsapp";
    if (source === "link") return "link";
    if (source === "widget") return "website";
    return "other";
}

function nameOf(row: SessionRow): { name: string; number: string | null } {
    const metadata = row.metadata ?? {};
    const number = typeof metadata.customer_number === "string" ? `+${metadata.customer_number.replace(/^\+/, "")}` : null;
    const name = typeof metadata.customer_name === "string" && metadata.customer_name.trim() ? metadata.customer_name.trim() : null;
    const channel = channelOf(metadata);
    return { name: name ?? number ?? (channel === "link" ? "Visitor from your link" : "Website visitor"), number };
}

/** The assistant's words in a completed turn (its output messages' text parts). */
function outputText(output: unknown): string {
    if (!Array.isArray(output)) return "";
    return output
        .filter((item): item is { role?: string; content?: unknown } => !!item && typeof item === "object")
        .filter((item) => item.role === "assistant" && Array.isArray(item.content))
        .flatMap((item) => (item.content as Array<{ text?: unknown }>).map((part) => (typeof part.text === "string" ? part.text : "")))
        .join("\n")
        .trim();
}

/** A project's customer conversations (console previews left out), newest first. */
export async function listConversations(db: Admin, projectId: string, opts: { channel?: InboxChannel | null; limit?: number } = {}): Promise<InboxConversation[]> {
    let query = db.from("sessions").select(SESSION_COLUMNS)
        .eq("project_id", projectId)
        .or("metadata->>preview.is.null,metadata->>preview.eq.false")
        .order("updated_at", { ascending: false })
        .limit(Math.min(100, opts.limit ?? 50));
    if (opts.channel === "whatsapp") query = query.eq("metadata->>source", "whatsapp");
    else if (opts.channel === "website") query = query.eq("metadata->>source", "widget");
    else if (opts.channel === "link") query = query.eq("metadata->>source", "link");
    const { data } = await query;
    const sessions = (data ?? []) as SessionRow[];
    if (sessions.length === 0) return [];

    // Each conversation's last turn only.
    const lastTurns = sessions.filter((row) => (row.last_turn_number ?? 0) > 0);
    const { data: events } = lastTurns.length
        ? await db.from("session_events").select(EVENT_COLUMNS)
            .in("event_type", ["turn.started", "turn.completed"])
            .or(lastTurns.map((row) => `and(session_id.eq.${row.id},turn_number.eq.${row.last_turn_number})`).join(","))
        : { data: [] };
    const bySession = new Map<string, EventRow[]>();
    for (const event of (events ?? []) as EventRow[]) bySession.set(event.session_id, [...(bySession.get(event.session_id) ?? []), event]);

    return sessions.map((row) => {
        const turn = bySession.get(row.id) ?? [];
        const reply = outputText(turn.find((event) => event.event_type === "turn.completed")?.output);
        const startedInput = turn.find((event) => event.event_type === "turn.started")?.input ?? null;
        const asked = startedInput ? withoutCatchUpNote(startedInput) : null;
        const turnAt = Math.max(0, ...turn.map((event) => new Date(event.created_at).getTime()));
        // A message sent while the assistant was paused, if it's the newest.
        const manual = manualMessages(row.metadata).at(-1);
        const manualIsLast = !!manual && new Date(manual.at).getTime() > turnAt;
        const { name, number } = nameOf(row);
        return {
            id: row.id,
            channel: channelOf(row.metadata),
            name,
            number,
            last_message: manualIsLast ? manual!.text : reply || asked,
            last_from: manualIsLast ? manual!.from : reply ? "assistant" : asked ? "customer" : null,
            updated_at: row.updated_at,
            open: row.status === "active",
            needs_owner: needsOwner(row.metadata),
            owner_active: isOwnerActive(row.metadata),
        };
    });
}

/** One conversation with its messages, in order. Null when it isn't this project's. */
/** Whether the owner can reply from Studio, and if not, why: a chat from elsewhere (the API), or WhatsApp's 24-hour window has closed. */
export type ReplyAbility = { possible: true; reason: null } | { possible: false; reason: "website" | "window" };

export async function getConversation(db: Admin, projectId: string, sessionId: string): Promise<{ conversation: InboxConversation; messages: InboxMessage[]; reply: ReplyAbility } | null> {
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
    const { data } = await db.from("sessions").select(SESSION_COLUMNS).eq("id", sessionId).eq("project_id", projectId).maybeSingle();
    const row = data as SessionRow | null;
    if (!row) return null;
    const { data: events } = await db.from("session_events").select(EVENT_COLUMNS)
        .eq("session_id", sessionId).in("event_type", ["turn.started", "turn.completed"])
        .order("turn_number", { ascending: true }).order("created_at", { ascending: true })
        .limit(400);
    const messages: InboxMessage[] = [];
    for (const event of (events ?? []) as EventRow[]) {
        const said = event.input ? withoutCatchUpNote(event.input).trim() : "";
        if (event.event_type === "turn.started" && said) {
            messages.push({ id: `${event.turn_number}:in`, from: "customer", text: said, at: event.created_at });
        } else if (event.event_type === "turn.completed") {
            const text = outputText(event.output);
            if (text) messages.push({ id: `${event.turn_number}:out`, from: "assistant", text, at: event.created_at });
        }
    }
    for (const message of manualMessages(row.metadata)) messages.push({ id: message.id, from: message.from, text: message.text, at: message.at });
    messages.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    const { name, number } = nameOf(row);
    const last = messages[messages.length - 1];
    const channel = channelOf(row.metadata);
    const lastFromCustomer = [...messages].reverse().find((message) => message.from === "customer");
    const windowOpen = !!lastFromCustomer && Date.now() - new Date(lastFromCustomer.at).getTime() < REPLY_WINDOW_MS;
    return {
        conversation: {
            id: row.id, channel, name, number,
            last_message: last?.text ?? null, last_from: last?.from ?? null,
            updated_at: row.updated_at, open: row.status === "active",
            needs_owner: needsOwner(row.metadata), owner_active: isOwnerActive(row.metadata),
        },
        messages,
        // Replying from Studio: website and link chats any time (the visitor sees it
        // while the chat is open); WhatsApp inside its 24-hour window.
        reply: channel === "website" || channel === "link"
            ? { possible: true, reason: null }
            : channel !== "whatsapp"
                ? { possible: false, reason: "website" as const }
                : windowOpen ? { possible: true, reason: null } : { possible: false, reason: "window" as const },
    };
}
