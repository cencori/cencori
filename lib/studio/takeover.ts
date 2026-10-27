/**
 * Stepping in: an owner takes over one conversation from the assistant.
 *
 * All of it lives on the conversation (sessions.metadata), never in the
 * assistant's own turn log:
 *   owner_active_at  when the owner last stepped in or replied; while that's
 *                    under 30 minutes old the assistant stays quiet in this
 *                    chat (so it hands back on its own after a quiet spell)
 *   needs_owner      { reason, at }: the assistant handed the customer over
 *                    or asked for a callback; cleared once the owner acts
 *   manual_messages  what the customer and the owner said while the
 *                    assistant was paused; `seen` turns true once the
 *                    assistant has been shown them
 */

import type { createAdminClient } from "@/lib/supabaseAdmin";

type Admin = ReturnType<typeof createAdminClient>;

export const OWNER_IDLE_MS = 30 * 60_000;
const MANUAL_MESSAGES_MAX = 200;

export interface ManualMessage {
    id: string;
    from: "customer" | "owner";
    text: string;
    at: string;
    seen?: boolean;
}

export interface NeedsOwner {
    reason: string;
    at: string;
}

type Metadata = Record<string, unknown> & {
    owner_active_at?: string | null;
    needs_owner?: NeedsOwner | null;
    manual_messages?: ManualMessage[];
};

/** The owner is handling this chat right now (stepped in, and not quiet for 30 minutes). */
export function isOwnerActive(metadata: Record<string, unknown> | null | undefined, now = Date.now()): boolean {
    const at = (metadata as Metadata | null | undefined)?.owner_active_at;
    return typeof at === "string" && now - new Date(at).getTime() < OWNER_IDLE_MS;
}

export function needsOwner(metadata: Record<string, unknown> | null | undefined): NeedsOwner | null {
    const flag = (metadata as Metadata | null | undefined)?.needs_owner;
    return flag && typeof flag.reason === "string" ? flag : null;
}

export function manualMessages(metadata: Record<string, unknown> | null | undefined): ManualMessage[] {
    const list = (metadata as Metadata | null | undefined)?.manual_messages;
    return Array.isArray(list) ? list.filter((m) => m && typeof m.text === "string" && (m.from === "customer" || m.from === "owner")) : [];
}

/** Read, change and write one conversation's metadata. */
async function patchMetadata(db: Admin, sessionId: string, change: (metadata: Metadata) => Metadata, touch = false): Promise<Metadata | null> {
    const { data } = await db.from("sessions").select("metadata").eq("id", sessionId).maybeSingle();
    if (!data) return null;
    const next = change({ ...((data.metadata as Metadata | null) ?? {}) });
    await db.from("sessions").update({ metadata: next, ...(touch ? { updated_at: new Date().toISOString() } : {}) }).eq("id", sessionId);
    return next;
}

/** The assistant handed a customer over or asked for a callback: the owner should look. */
export async function flagNeedsOwner(db: Admin, sessionId: string | null | undefined, reason: string): Promise<void> {
    if (!sessionId) return;
    await patchMetadata(db, sessionId, (metadata) => ({ ...metadata, needs_owner: { reason: reason.slice(0, 300), at: new Date().toISOString() } }), true);
}

export async function stepIn(db: Admin, sessionId: string): Promise<Metadata | null> {
    return patchMetadata(db, sessionId, (metadata) => ({ ...metadata, owner_active_at: new Date().toISOString(), needs_owner: null }));
}

export async function handBack(db: Admin, sessionId: string): Promise<Metadata | null> {
    return patchMetadata(db, sessionId, (metadata) => ({ ...metadata, owner_active_at: null, needs_owner: null }));
}

/** Record a message sent while the assistant was paused; an owner's reply also keeps the pause going. */
export async function addManualMessage(db: Admin, sessionId: string, message: Omit<ManualMessage, "id" | "at" | "seen">): Promise<Metadata | null> {
    const entry: ManualMessage = { ...message, id: crypto.randomUUID(), at: new Date().toISOString(), seen: false };
    return patchMetadata(db, sessionId, (metadata) => ({
        ...metadata,
        manual_messages: [...manualMessages(metadata), entry].slice(-MANUAL_MESSAGES_MAX),
        ...(message.from === "owner" ? { owner_active_at: entry.at, needs_owner: null } : {}),
    }), true);
}

/**
 * What the assistant missed while it was paused, as a note for its next turn,
 * and mark it seen. Null when there's nothing new.
 */
export async function takeUnseenManualMessages(db: Admin, sessionId: string): Promise<string | null> {
    let note: string | null = null;
    await patchMetadata(db, sessionId, (metadata) => {
        const list = manualMessages(metadata);
        const unseen = list.filter((m) => !m.seen);
        if (unseen.length === 0) return metadata;
        note = `[While you were paused, the business owner talked with the customer directly:\n${unseen.slice(-20).map((m) => `${m.from === "owner" ? "Owner" : "Customer"}: ${m.text}`).join("\n")}\nCarry on from there; don't repeat what the owner already said.]`;
        return { ...metadata, manual_messages: list.map((m) => ({ ...m, seen: true })) };
    });
    return note;
}
