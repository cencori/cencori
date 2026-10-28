import "server-only";

import type { createAdminClient } from "@/lib/supabaseAdmin";
import { isOwnerActive, isUnread, manualMessages, needsOwner, readAt, withoutCatchUpNote, type NeedsOwner } from "@/lib/studio/takeover";

type Admin = ReturnType<typeof createAdminClient>;

export type InboxChannel = "whatsapp" | "website" | "link" | "other";

export interface InboxConversation {
    id: string;
    channel: InboxChannel;
    /** What the owner sees: the customer's WhatsApp name, else their number, else "Website visitor". */
    name: string;
    /** A real name (WhatsApp gives one), not a stand-in. */
    named: boolean;
    /** What they came for, from their first message ("Laptops under ₦500k"); null when it was only a greeting. */
    topic: string | null;
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
    /** The customer wrote since the person asking last opened it. */
    unread: boolean;
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

function nameOf(row: SessionRow): { name: string; number: string | null; named: boolean } {
    const metadata = row.metadata ?? {};
    const number = typeof metadata.customer_number === "string" ? `+${metadata.customer_number.replace(/^\+/, "")}` : null;
    const name = typeof metadata.customer_name === "string" && metadata.customer_name.trim() ? metadata.customer_name.trim() : null;
    const channel = channelOf(metadata);
    return { name: name ?? number ?? (channel === "link" ? "Visitor from your link" : "Website visitor"), number, named: !!name };
}

const GREETING = /^(hi+|hello+|hey+|hiya|good\s+(morning|afternoon|evening|day)|how\s+far|howdy|yo|sup|wassup|what['’]?s\s+up|how['’]?s\s+it\s+going|how\s+are\s+you(\s+doing)?(\s+today)?|how\s+is\s+it\s+going|hallo|ekaaro|ekasan|ekaale|bawo|nnoo|sannu|please|pls|abeg|sir|ma|madam|boss|dear)\b[\s,!.?]*/i;

/**
 * What a customer came for, from their first message, in a few words: the
 * greeting gone, the first sentence, up to six words. Null when the message
 * was only a greeting ("Hi!").
 */
export function topicOf(message: string | null | undefined): string | null {
    let text = (message ?? "").replace(/\s+/g, " ").trim();
    // "Hi, good morning, please …": every greeting off the front.
    for (let i = 0; i < 4 && GREETING.test(text); i++) text = text.replace(GREETING, "").trim();
    text = text.split(/(?<=[.!?])\s/)[0].replace(/[.!?,;:]+$/, "").trim();
    if (text.length < 3) return null;
    const words = text.split(" ");
    const short = words.slice(0, 6).join(" ");
    return `${short.charAt(0).toUpperCase()}${short.slice(1)}${words.length > 6 ? "…" : ""}`;
}

/** A message as one plain line for the inbox preview: no Markdown (bold, bullets, headings), no line breaks. */
function previewText(text: string | null | undefined): string | null {
    if (!text) return null;
    const plain = text
        .replace(/\*\*|__|`/g, "")
        .replace(/^\s*(#{1,6}\s+|[-*•]\s+|\d+[.)]\s+)/gm, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/\s+/g, " ")
        .trim();
    return plain || null;
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
/** The newest customer and owner message times among the paused-chat messages. */
function manualTimes(metadata: Record<string, unknown> | null): { customer: number | null; owner: number | null } {
    let customer: number | null = null;
    let owner: number | null = null;
    for (const message of manualMessages(metadata)) {
        const at = Date.parse(message.at);
        if (!Number.isFinite(at)) continue;
        if (message.from === "customer") customer = Math.max(customer ?? 0, at);
        else owner = Math.max(owner ?? 0, at);
    }
    return { customer, owner };
}

const latest = (...times: Array<number | null>): number | null => {
    const known = times.filter((time): time is number => time !== null);
    return known.length ? Math.max(...known) : null;
};

export async function listConversations(db: Admin, projectId: string, opts: { channel?: InboxChannel | null; limit?: number; userId: string }): Promise<InboxConversation[]> {
    let query = db.from("sessions").select(SESSION_COLUMNS)
        .eq("project_id", projectId)
        .or("metadata->>preview.is.null,metadata->>preview.eq.false")
        // Only chats where someone said something: a chat window opened and never used isn't a conversation.
        .or("last_turn_number.gt.0,metadata->manual_messages.not.is.null")
        .order("updated_at", { ascending: false })
        .limit(Math.min(100, opts.limit ?? 50));
    if (opts.channel === "whatsapp") query = query.eq("metadata->>source", "whatsapp");
    else if (opts.channel === "website") query = query.eq("metadata->>source", "widget");
    else if (opts.channel === "link") query = query.eq("metadata->>source", "link");
    const { data } = await query;
    const sessions = (data ?? []) as SessionRow[];
    if (sessions.length === 0) return [];

    // Each conversation's last turn, and its first message (what they came for).
    const lastTurns = sessions.filter((row) => (row.last_turn_number ?? 0) > 0);
    const [{ data: events }, { data: firsts }] = lastTurns.length
        ? await Promise.all([
            db.from("session_events").select(EVENT_COLUMNS)
                .in("event_type", ["turn.started", "turn.completed"])
                .or(lastTurns.map((row) => `and(session_id.eq.${row.id},turn_number.eq.${row.last_turn_number})`).join(",")),
            db.from("session_events").select("session_id, input:payload->>input_text")
                .eq("event_type", "turn.started").eq("turn_number", 1)
                .in("session_id", lastTurns.map((row) => row.id)),
        ])
        : [{ data: [] }, { data: [] }];
    const bySession = new Map<string, EventRow[]>();
    for (const event of (events ?? []) as EventRow[]) bySession.set(event.session_id, [...(bySession.get(event.session_id) ?? []), event]);
    const firstMessage = new Map(((firsts ?? []) as Array<{ session_id: string; input: string | null }>).map((event) => [event.session_id, event.input ? withoutCatchUpNote(event.input) : null]));

    return sessions.map((row) => {
        const turn = bySession.get(row.id) ?? [];
        const reply = outputText(turn.find((event) => event.event_type === "turn.completed")?.output);
        const startedInput = turn.find((event) => event.event_type === "turn.started")?.input ?? null;
        const asked = startedInput ? withoutCatchUpNote(startedInput) : null;
        const turnAt = Math.max(0, ...turn.map((event) => new Date(event.created_at).getTime()));
        // A message sent while the assistant was paused, if it's the newest.
        const manual = manualMessages(row.metadata).at(-1);
        const manualIsLast = !!manual && new Date(manual.at).getTime() > turnAt;
        const { name, number, named } = nameOf(row);
        // Every turn starts with the customer's message.
        const started = turn.find((event) => event.event_type === "turn.started");
        const manualAt = manualTimes(row.metadata);
        return {
            id: row.id,
            channel: channelOf(row.metadata),
            name,
            named,
            topic: topicOf(firstMessage.get(row.id) ?? manualMessages(row.metadata).find((message) => message.from === "customer")?.text),
            number,
            last_message: previewText(manualIsLast ? manual!.text : reply || asked),
            last_from: manualIsLast ? manual!.from : reply ? "assistant" : asked ? "customer" : null,
            updated_at: row.updated_at,
            open: row.status === "active",
            needs_owner: needsOwner(row.metadata),
            owner_active: isOwnerActive(row.metadata),
            unread: isUnread(latest(started ? Date.parse(started.created_at) : null, manualAt.customer), manualAt.owner, readAt(row.metadata, opts.userId)),
        };
    });
}

/** One conversation with its messages, in order. Null when it isn't this project's. */
/** Whether the owner can reply from Studio, and if not, why: a chat from elsewhere (the API), or WhatsApp's 24-hour window has closed. */
export type ReplyAbility = { possible: true; reason: null } | { possible: false; reason: "website" | "window" };

export async function getConversation(db: Admin, projectId: string, sessionId: string, userId: string): Promise<{ conversation: InboxConversation; messages: InboxMessage[]; reply: ReplyAbility } | null> {
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

    const { name, number, named } = nameOf(row);
    const last = messages[messages.length - 1];
    const channel = channelOf(row.metadata);
    const lastFromCustomer = [...messages].reverse().find((message) => message.from === "customer");
    const windowOpen = !!lastFromCustomer && Date.now() - new Date(lastFromCustomer.at).getTime() < REPLY_WINDOW_MS;
    return {
        conversation: {
            id: row.id, channel, name, named, number,
            topic: topicOf(messages.find((message) => message.from === "customer")?.text),
            last_message: last?.text ?? null, last_from: last?.from ?? null,
            updated_at: row.updated_at, open: row.status === "active",
            needs_owner: needsOwner(row.metadata), owner_active: isOwnerActive(row.metadata),
            unread: isUnread(
                latest(...messages.filter((message) => message.from === "customer").map((message) => Date.parse(message.at))),
                latest(...messages.filter((message) => message.from === "owner").map((message) => Date.parse(message.at))),
                readAt(row.metadata, userId),
            ),
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
