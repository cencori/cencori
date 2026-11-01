import "server-only";

import { randomInt } from "crypto";
import type { createAdminClient } from "@/lib/supabaseAdmin";
import { getMainSiteUrl } from "@/lib/main-site-url";
import { decryptApiKey } from "@/lib/encryption";
import {
    channelAccessToken,
    ensureTemplate,
    getAgentChannel,
    getChannelById,
    sendTemplate,
    sendText,
    type WhatsAppChannel,
} from "@/lib/channels/whatsapp";

/**
 * The owner talks to their employee on WhatsApp, like texting a member of
 * staff: the same conversation as Studio's AI tab, with its memory, business
 * tools and personality.
 *
 * - Linking: the app shows a one-tap WhatsApp link to the employee's number
 *   with "Link 4831" typed in; the owner sends it. Holding both the signed-in
 *   app and that WhatsApp is the proof (a number typed in can be mistyped, and
 *   owner mode sees the money).
 * - From a linked number, messages skip the customer flow: they're asked of
 *   the owner's employee chat (POST /api/agent, as the owner, with a session
 *   made for the purpose), and the answer goes back on WhatsApp.
 * - A change that needs the owner's confirmation in the app (a confirmation
 *   card) is asked as a question: YES runs it exactly as the card would.
 * - The employee writes first, too: whatever pushes to the owner's phone
 *   (needs you, transfers to check, the morning brief) also goes to their
 *   WhatsApp, inside WhatsApp's 24-hour window as a message and outside it as
 *   an approved template that says there's news.
 *
 * Kept per project (connector_slug 'owner-whatsapp').
 */

type Admin = ReturnType<typeof createAdminClient>;

export const OWNER_WHATSAPP_SLUG = "owner-whatsapp";
const CODE_TTL_MS = 15 * 60_000;
/** A message is free and allowed within 24 hours of the owner's last one; a little margin. */
const WINDOW_MS = 23.5 * 3_600_000;

/** Outside the 24-hour window: "there's news, reply", approved on the number's WhatsApp account. */
const UPDATE_TEMPLATE = {
    name: "owner_update_v1",
    language: "en",
    category: "UTILITY" as const,
    body: "Hi {{1}}, it's {{2}}. {{3}} Reply here and I'll tell you more.",
    example: ["Bola", "Ada", "Kemi says she sent ₦20,000 by transfer, so check your account."],
};

export interface PendingAction {
    id: string;
    title: string;
    tier: string;
    confirmPhrase?: string;
    details: Array<{ label: string; value: string }>;
    request: { method: string; path: string; body?: Record<string, unknown> };
    steps?: Array<{ method: string; path: string; body?: Record<string, unknown> }>;
    doneMessage: string;
    asked_at: string;
}

export interface OwnerLink {
    user_id: string;
    agent_id: string;
    channel_id: string;
    /** Their WhatsApp number, digits with the country code; empty while waiting for the code. */
    phone: string;
    status: "pending" | "active";
    code: string | null;
    created_at: string;
    linked_at: string | null;
    last_inbound_at: string | null;
    pending_action: PendingAction | null;
}

interface Row { id: string; links: OwnerLink[]; templates: Record<string, string> }

async function row(db: Admin, projectId: string): Promise<Row | null> {
    const { data } = await db.from("tool_connections").select("id, metadata").eq("project_id", projectId).eq("connector_slug", OWNER_WHATSAPP_SLUG).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const metadata = data?.metadata as { kind?: string; links?: OwnerLink[]; templates?: Record<string, string> } | undefined;
    if (!data || metadata?.kind !== "owner_whatsapp") return null;
    return { id: data.id as string, links: Array.isArray(metadata.links) ? metadata.links : [], templates: metadata.templates ?? {} };
}

/** Change the links (re-read first, so two messages at once don't undo each other). */
async function change(db: Admin, projectId: string, edit: (links: OwnerLink[], templates: Record<string, string>) => { links: OwnerLink[]; templates?: Record<string, string> }): Promise<OwnerLink[]> {
    const current = await row(db, projectId);
    const next = edit(current?.links ?? [], current?.templates ?? {});
    const metadata = { kind: "owner_whatsapp", links: next.links.slice(-50), templates: next.templates ?? current?.templates ?? {}, updated_at: new Date().toISOString() };
    if (current) await db.from("tool_connections").update({ metadata }).eq("id", current.id);
    else await db.from("tool_connections").insert({ project_id: projectId, connector_slug: OWNER_WHATSAPP_SLUG, owner_type: "platform", status: "active", metadata });
    return next.links;
}

async function tokenFor(db: Admin, channel: WhatsAppChannel): Promise<string | null> {
    const { data } = await db.from("projects").select("organization_id").eq("id", channel.projectId).maybeSingle();
    const organizationId = (data?.organization_id as string | undefined) ?? "";
    return channelAccessToken(channel, (value) => {
        try {
            return decryptApiKey(value, organizationId);
        } catch {
            return null;
        }
    });
}

export type LinkStart =
    | { ok: true; code: string; number: string; link: string; linked_phone: string | null }
    | { ok: false; message: string };

/**
 * Start linking: a code and the one-tap link to send it to the employee's
 * number. Linking again (another phone) replaces the earlier link.
 */
export async function startOwnerLink(db: Admin, opts: { projectId: string; userId: string; agentId: string }): Promise<LinkStart> {
    const channel = await getAgentChannel(db, opts.projectId, opts.agentId);
    if (!channel || !channel.metadata.enabled) return { ok: false, message: "This employee doesn't have a WhatsApp number yet. Connect one first, then you can text them." };
    if (channel.metadata.coexistence) return { ok: false, message: "This employee answers on your own WhatsApp Business number, and you can't text yourself. Give them a number of their own to talk to them on WhatsApp." };
    const digits = (channel.metadata.display_phone_number ?? "").replace(/\D/g, "");
    if (!digits) return { ok: false, message: "Couldn't read this employee's WhatsApp number. Try again in a minute." };
    const code = String(randomInt(1000, 10_000));
    const now = new Date().toISOString();
    const links = await change(db, opts.projectId, (links) => {
        const existing = links.find((link) => link.user_id === opts.userId && link.agent_id === opts.agentId);
        const rest = links.filter((link) => link !== existing);
        const next: OwnerLink = existing
            ? { ...existing, code, created_at: now, ...(existing.status === "active" ? {} : { status: "pending" as const }) }
            : { user_id: opts.userId, agent_id: opts.agentId, channel_id: channel.id, phone: "", status: "pending", code, created_at: now, linked_at: null, last_inbound_at: null, pending_action: null };
        return { links: [...rest, next] };
    });
    const mine = links.find((link) => link.user_id === opts.userId && link.agent_id === opts.agentId);
    // Asking for the template now means it's approved by the time there's news to send.
    void (async () => {
        const token = await tokenFor(db, channel);
        if (token) await ensureTemplate(channel, token, UPDATE_TEMPLATE).catch(() => undefined);
    })();
    return {
        ok: true,
        code,
        number: `+${digits}`,
        link: `https://wa.me/${digits}?text=${encodeURIComponent(`Link ${code}`)}`,
        linked_phone: mine?.status === "active" && mine.phone ? `+${mine.phone}` : null,
    };
}

/** Stop the owner's link with an employee (or all of theirs in the business). */
export async function unlinkOwner(db: Admin, projectId: string, userId: string, agentId?: string): Promise<number> {
    let removed = 0;
    await change(db, projectId, (links) => ({
        links: links.filter((link) => {
            const drop = link.user_id === userId && (!agentId || link.agent_id === agentId);
            if (drop) removed++;
            return !drop;
        }),
    }));
    return removed;
}

/** Whether the owner is linked with an employee, and on which number. */
export async function ownerLinkStatus(db: Admin, projectId: string, userId: string, agentId: string): Promise<{ linked: boolean; phone: string | null }> {
    const link = (await row(db, projectId))?.links.find((item) => item.user_id === userId && item.agent_id === agentId && item.status === "active");
    return { linked: !!link, phone: link?.phone ? `+${link.phone}` : null };
}

/** The link a message from this number on this employee's number belongs to, if it's the owner's. */
async function linkFor(db: Admin, channel: WhatsAppChannel, from: string): Promise<OwnerLink | null> {
    return (await row(db, channel.projectId))?.links.find((link) => link.channel_id === channel.id && link.status === "active" && link.phone === from) ?? null;
}

/** "Link 4831": the code from the app, sent from the owner's WhatsApp. Returns the link it completed. */
async function completeLink(db: Admin, channel: WhatsAppChannel, from: string, text: string): Promise<OwnerLink | null> {
    const code = /^\s*link\s*(\d{4})\s*$/i.exec(text)?.[1];
    if (!code) return null;
    let done: OwnerLink | null = null;
    const now = Date.now();
    await change(db, channel.projectId, (links) => ({
        links: links.map((link) => {
            if (link.channel_id !== channel.id || link.code !== code || now - Date.parse(link.created_at) > CODE_TTL_MS) return link;
            done = { ...link, status: "active", phone: from, code: null, linked_at: new Date().toISOString(), last_inbound_at: new Date().toISOString() };
            return done;
        }),
    }));
    return done;
}

async function patchLink(db: Admin, projectId: string, link: OwnerLink, patch: Partial<OwnerLink>): Promise<void> {
    await change(db, projectId, (links) => ({ links: links.map((item) => (item.user_id === link.user_id && item.agent_id === link.agent_id ? { ...item, ...patch } : item)) }));
}

/** A short-lived session for the owner, so the employee chat and actions run as them. */
async function ownerSession<T>(userId: string, run: (token: string) => Promise<T>): Promise<T> {
    const { auth } = await import("@/lib/auth/better-auth");
    const ctx = await auth.$context;
    const session = await ctx.internalAdapter.createSession(userId, true);
    try {
        return await run(session.token);
    } finally {
        await ctx.internalAdapter.deleteSession(session.token).catch(() => undefined);
    }
}

const origin = () => (process.env.STUDIO_INTERNAL_ORIGIN || getMainSiteUrl("/")).replace(/\/$/, "");

/** Ask the owner's employee chat, as the owner: the reply, and any change it proposes. */
async function askEmployee(token: string, opts: { projectId: string; organizationId: string; agentId: string; userName: string | null; text: string; hidden?: boolean }): Promise<{ content: string; actions: Array<Omit<PendingAction, "asked_at">> }> {
    const response = await fetch(`${origin()}/api/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
            messages: [{ role: "user", content: opts.text }],
            thread: true,
            messageId: crypto.randomUUID(),
            hidden: opts.hidden === true,
            projectId: opts.projectId,
            organizationId: opts.organizationId,
            agentId: opts.agentId,
            conversationId: crypto.randomUUID(),
            environment: "production",
            currentPath: "studio",
            currentSurface: "WhatsApp: the owner is texting you on WhatsApp. Plain short messages, no headings or tables. There are no cards or buttons here: a change that needs their confirmation is asked as a question they answer YES to.",
            userName: opts.userName,
        }),
        signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok || !response.body) {
        const failure = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(failure?.error ?? `The employee chat failed (${response.status})`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    const actions: Array<Omit<PendingAction, "asked_at">> = [];
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
            const line = chunk.split("\n").find((item) => item.startsWith("data: "));
            if (!line || line === "data: [DONE]") continue;
            const payload = JSON.parse(line.slice(6)) as { content?: string; discard?: boolean; error?: string; action?: Omit<PendingAction, "asked_at"> };
            if (payload.error) throw new Error(payload.error);
            if (payload.discard) content = "";
            if (payload.content) content += payload.content;
            if (payload.action) actions.push(payload.action);
        }
    }
    return { content: content.trim(), actions };
}

/** Run a confirmed change the way the app's card does: its request (or steps) as the owner. */
async function runConfirmed(token: string, action: PendingAction): Promise<{ ok: boolean; result: string }> {
    const steps = action.steps?.length ? action.steps : [action.request];
    const vars: Record<string, string> = {};
    for (const [index, raw] of steps.entries()) {
        const step = JSON.parse(JSON.stringify(raw).replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match)) as typeof raw;
        // Only Cencori's own endpoints, never an address a model wrote.
        if (!step.path.startsWith("/api/")) return { ok: false, result: "That change can't be made from WhatsApp. Do it in the app." };
        const response = await fetch(`${origin()}${step.path}`, {
            method: step.method,
            headers: { Authorization: `Bearer ${token}`, ...(step.body ? { "Content-Type": "application/json" } : {}) },
            body: step.body ? JSON.stringify(step.body) : undefined,
            signal: AbortSignal.timeout(60_000),
        }).catch(() => null);
        const payload = await response?.json().catch(() => null) as ({ error?: string } & Record<string, unknown>) | null;
        if (!response?.ok) {
            const reason = payload?.error || "It didn't go through.";
            return { ok: false, result: index === 0 ? reason : `${reason} (step ${index + 1} of ${steps.length}; the earlier steps went through)` };
        }
        for (const [key, value] of Object.entries(payload ?? {})) if (typeof value === "string" && /_id$/.test(key)) vars[key] = value;
    }
    return { ok: true, result: action.doneMessage };
}

/** "Send Kemi a payment link for ₦15,000? (To: Kemi · Amount: ₦15,000) Reply YES to do it." */
function confirmQuestion(action: Omit<PendingAction, "asked_at">): string {
    const details = action.details.slice(0, 5).map((detail) => `${detail.label}: ${detail.value}`).join("\n");
    const phrase = action.tier === "destructive" && action.confirmPhrase ? action.confirmPhrase.toUpperCase() : "YES";
    return `${action.title}?${details ? `\n${details}` : ""}\n\nReply ${phrase} to do it, or NO.`;
}

const isYes = (text: string, action: PendingAction) => {
    const said = text.trim().toLowerCase().replace(/[.!]+$/, "");
    if (action.tier === "destructive" && action.confirmPhrase) return said === action.confirmPhrase.toLowerCase();
    return ["yes", "y", "yeah", "yep", "ok", "okay", "confirm", "go ahead", "do it", "sure"].includes(said);
};
const isNo = (text: string) => ["no", "n", "nope", "cancel", "stop", "don't", "dont"].includes(text.trim().toLowerCase().replace(/[.!]+$/, ""));

/** What the employee is told after a change settles, as the app tells it (copilot.tsx actionOutcomeNote). */
function outcomeNote(action: PendingAction, outcome: { ok: boolean; result: string } | null): string {
    if (!outcome) return `[The owner said no to "${action.title}". Nothing was changed.] Acknowledge it in one short sentence.`;
    if (outcome.ok) return `[The owner confirmed "${action.title}" on WhatsApp and it succeeded: ${outcome.result}] Tell them in one or two plain sentences what changed.`;
    return `[The owner confirmed "${action.title}" on WhatsApp but it failed: ${outcome.result}] Explain briefly what went wrong and what they can do.`;
}

/**
 * A message on an employee's number from the owner (a linked number, or the
 * "Link" code that links it): answered as their employee. Returns false for
 * anyone else, who gets the customer flow.
 */
export async function answerOwnerOnWhatsApp(db: Admin, channel: WhatsAppChannel, from: string, texts: string[], token: string): Promise<boolean> {
    const text = texts.join("\n").trim();
    if (!text) return false;
    let link = await linkFor(db, channel, from);
    let justLinked = false;
    if (!link) {
        link = await completeLink(db, channel, from, text);
        if (!link) return false;
        justLinked = true;
    }
    const { data: project } = await db.from("projects").select("organization_id").eq("id", channel.projectId).maybeSingle();
    const organizationId = (project?.organization_id as string | undefined) ?? "";
    const { adminUsers } = await import("@/lib/auth/admin-users");
    const { data: found } = await adminUsers.getUserById(link.user_id);
    const meta = (found?.user?.user_metadata ?? {}) as Record<string, string | undefined>;
    const userName = meta.first_name || meta.full_name?.split(" ")[0] || null;
    const reply = (message: string) => sendText(channel, token, from, message).catch((error) => console.error("[owner-whatsapp] send failed", error instanceof Error ? error.message : error));
    const ask = (body: string, hidden = false) => ownerSession(link!.user_id, (session) => askEmployee(session, { projectId: channel.projectId, organizationId, agentId: link!.agent_id, userName, text: body, hidden }));

    try {
        if (justLinked) {
            const answer = await ask("[The owner just linked their WhatsApp to you: from now on they can text you here, and you'll message them here when something needs them.] Greet them in one or two short sentences, by name, and tell them they can ask you anything about the business here.", true);
            await reply(answer.content || `Hi${userName ? ` ${userName}` : ""}! We're connected. Text me here anytime.`);
            return true;
        }
        await patchLink(db, channel.projectId, link, { last_inbound_at: new Date().toISOString() });

        // An answer to a change she asked about.
        const pending = link.pending_action;
        if (pending && (isYes(text, pending) || isNo(text))) {
            await patchLink(db, channel.projectId, link, { pending_action: null });
            const outcome = isYes(text, pending) ? await ownerSession(link.user_id, (session) => runConfirmed(session, pending)) : null;
            const answer = await ask(outcomeNote(pending, outcome), true);
            await reply(answer.content || (outcome ? outcome.result : "Okay, I won't."));
            return true;
        }
        // Anything else moves on: an unanswered change lapses, as in the app.
        if (pending) await patchLink(db, channel.projectId, link, { pending_action: null });

        const answer = await ask(text);
        if (answer.content) await reply(answer.content);
        const [first] = answer.actions;
        if (first) {
            await patchLink(db, channel.projectId, link, { pending_action: { ...first, asked_at: new Date().toISOString() } });
            await reply(confirmQuestion(first));
        }
    } catch (error) {
        console.error("[owner-whatsapp] answer failed", error instanceof Error ? error.message : error);
        await reply("Sorry, I couldn't get to that just now. Try again in a minute, or ask me in the app.");
    }
    return true;
}

/**
 * Tell the business's linked owners on WhatsApp what their phone is told
 * (lib/studio/push.ts): a message inside the 24-hour window, else the
 * approved "there's news" template. One message per owner. Best-effort.
 */
export async function tellOwnersOnWhatsApp(db: Admin, projectId: string, message: { title: string; body: string }): Promise<void> {
    const current = await row(db, projectId);
    const links = (current?.links ?? []).filter((link) => link.status === "active" && link.phone);
    if (!links.length) return;
    // An owner linked to two employees hears it once, from the one they talked to last.
    const byUser = new Map<string, OwnerLink>();
    for (const link of links) {
        const seen = byUser.get(link.user_id);
        if (!seen || Date.parse(link.last_inbound_at ?? "0") > Date.parse(seen.last_inbound_at ?? "0")) byUser.set(link.user_id, link);
    }
    const { adminUsers } = await import("@/lib/auth/admin-users");
    for (const link of byUser.values()) {
        try {
            const channel = await getChannelById(db, link.channel_id);
            if (!channel || !channel.metadata.enabled) continue;
            const token = await tokenFor(db, channel);
            if (!token) continue;
            const text = `${message.title}${message.body ? `\n${message.body}` : ""}`;
            const open = !!link.last_inbound_at && Date.now() - Date.parse(link.last_inbound_at) < WINDOW_MS;
            if (open) {
                await sendText(channel, token, link.phone, text);
                continue;
            }
            const status = await ensureTemplate(channel, token, UPDATE_TEMPLATE).catch(() => "MISSING");
            if (status !== "APPROVED") continue;
            const { data: found } = await adminUsers.getUserById(link.user_id);
            const meta = (found?.user?.user_metadata ?? {}) as Record<string, string | undefined>;
            const { data: agent } = await db.from("agents").select("name").eq("id", link.agent_id).maybeSingle();
            const summary = `${message.title}${message.body ? `: ${message.body}` : ""}`.replace(/\s+/g, " ").slice(0, 400);
            await sendTemplate(channel, token, link.phone, UPDATE_TEMPLATE, [meta.first_name || meta.full_name?.split(" ")[0] || "there", (agent?.name as string | undefined) ?? "your employee", summary.endsWith(".") ? summary : `${summary}.`]);
        } catch (error) {
            console.error("[owner-whatsapp] tell failed", error instanceof Error ? error.message : error);
        }
    }
}
