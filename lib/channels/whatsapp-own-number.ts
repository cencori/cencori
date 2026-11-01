import "server-only";

import { randomInt } from "crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import type { createAdminClient } from "@/lib/supabaseAdmin";
import { encryptApiKey } from "@/lib/encryption";
import type { SubscriptionTier } from "@/lib/entitlements";
import { ensureWidgetInstallation } from "@/lib/embedded/widget";
import {
    WHATSAPP_CHANNEL_SLUG,
    addPhoneNumber,
    findPhoneNumber,
    getAgentChannel,
    registerPhoneNumber,
    subscribeAppToWaba,
    requestVerificationCode,
    saveSignupChannel,
    verifyPhoneCode,
    type WhatsAppChannel,
} from "@/lib/channels/whatsapp";

/**
 * "Give your employee a WhatsApp number", with no Facebook: the owner types a
 * number, Meta texts or calls it a 6-digit code, the owner types the code in
 * Studiowave, and the number is the employee's. It works because the number
 * goes on Cencori's own WhatsApp Business Account (STUDIO_WABA_ID), acted on
 * with our system user's token (META_SYSTEM_USER_TOKEN); messages arrive on
 * the app's shared webhook like any number connected through our signup.
 *
 * A number still on the WhatsApp or WhatsApp Business app can't be taken this
 * way: Meta only moves a number off the app once its WhatsApp account there
 * is deleted (keeping the app AND the employee on one number is Meta's own
 * signup, with a Facebook login). Meta's error for that is turned into the
 * steps to do it.
 *
 * Between "send the code" and "check it", the number waits on the project
 * (connector_slug 'whatsapp-number-pending').
 */

type Admin = ReturnType<typeof createAdminClient>;

const PENDING_SLUG = "whatsapp-number-pending";
/** A code sent is good for this long, and the pending number with it. */
const PENDING_TTL_MS = 30 * 60_000;

export function ownNumberAvailable(): boolean {
    return !!process.env.STUDIO_WABA_ID && !!process.env.META_SYSTEM_USER_TOKEN;
}

export type NumberStep =
    | { ok: true; phone: string }
    | { ok: false; status: number; message: string; reason?: "on_whatsapp" | "taken" | "invalid" | "too_many" | "wrong_code" | "expired" };

/** "+234 801 234 5678" from what the owner typed; a local Nigerian number ("0801…") is read as Nigerian. */
export function readNumber(input: string): { cc: string; national: string; e164: string; pretty: string } | null {
    const parsed = parsePhoneNumberFromString(input.trim(), "NG");
    if (!parsed || !parsed.isValid()) return null;
    return { cc: parsed.countryCallingCode, national: parsed.nationalNumber, e164: parsed.number.replace(/^\+/, ""), pretty: parsed.formatInternational() };
}

/** Meta's error, as the owner should hear it, and what kind it is. */
export function explainMetaError(error: unknown): { message: string; reason?: NonNullable<Extract<NumberStep, { ok: false }>["reason"]> } {
    const text = error instanceof Error ? error.message : String(error ?? "");
    const code = (error as { code?: number } | null)?.code;
    if (/already (registered|in use)|registered (with|on|to) (a )?whatsapp|whatsapp account|migrat|being used/i.test(text)) {
        return { reason: "on_whatsapp", message: "This number is still on the WhatsApp app." };
    }
    if (/too many|rate|limit|try again later/i.test(text) || code === 136023 || code === 133016 || code === 80007) {
        return { reason: "too_many", message: "Meta has sent this number too many codes for now. Wait an hour, or ask for a call instead." };
    }
    if (/code.*(incorrect|invalid|mismatch|wrong)|verification code/i.test(text) || code === 136025) {
        return { reason: "wrong_code", message: "That code isn't right. Check the text or call, and try again." };
    }
    if (/expired/i.test(text)) return { reason: "expired", message: "That code has expired. Send a new one." };
    if (/display name|verified.?name|name/i.test(text)) return { message: `WhatsApp didn't accept the name: ${text}` };
    return { message: `WhatsApp said: ${text || "something went wrong"}. Try again in a minute.` };
}

interface Pending { agent_id: string; phone_number_id: string; phone: string; display_name: string; sent_at: string; method: "SMS" | "VOICE" }

async function pendingRow(db: Admin, projectId: string): Promise<{ id: string; pending: Pending } | null> {
    const { data } = await db.from("tool_connections").select("id, metadata").eq("project_id", projectId).eq("connector_slug", PENDING_SLUG).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const pending = (data?.metadata ?? null) as (Pending & { kind?: string }) | null;
    if (!data || pending?.kind !== "pending_number") return null;
    return { id: data.id as string, pending };
}

async function savePending(db: Admin, projectId: string, pending: Pending): Promise<void> {
    const existing = await pendingRow(db, projectId);
    const metadata = { kind: "pending_number", ...pending };
    if (existing) await db.from("tool_connections").update({ metadata }).eq("id", existing.id);
    else await db.from("tool_connections").insert({ project_id: projectId, connector_slug: PENDING_SLUG, owner_type: "platform", status: "active", metadata });
}

async function clearPending(db: Admin, projectId: string): Promise<void> {
    await db.from("tool_connections").delete().eq("project_id", projectId).eq("connector_slug", PENDING_SLUG);
}

/** Step one: put the number on our account (once) and have Meta text or call it the code. */
export async function sendNumberCode(db: Admin, opts: { projectId: string; agentId: string; phone: string; displayName: string; method: "SMS" | "VOICE" }): Promise<NumberStep> {
    const wabaId = process.env.STUDIO_WABA_ID;
    const token = process.env.META_SYSTEM_USER_TOKEN;
    if (!wabaId || !token) return { ok: false, status: 503, message: "Giving employees their own number isn't switched on yet." };
    const number = readNumber(opts.phone);
    if (!number) return { ok: false, status: 400, reason: "invalid", message: "That doesn't look like a phone number. Include the country code if it isn't Nigerian, like +44 7911 123456." };
    const name = opts.displayName.replace(/\s+/g, " ").trim().slice(0, 80);
    if (name.length < 3) return { ok: false, status: 400, message: "Give the name customers will see, at least 3 letters." };

    // A number another business already has on Studiowave stays theirs.
    const { data: elsewhere } = await db.from("tool_connections").select("project_id, metadata").eq("connector_slug", WHATSAPP_CHANNEL_SLUG).eq("status", "active").neq("project_id", opts.projectId).limit(500);
    const taken = ((elsewhere ?? []) as Array<{ metadata: { display_phone_number?: string | null } | null }>).some((row) => (row.metadata?.display_phone_number ?? "").replace(/\D/g, "") === number.e164);
    if (taken) return { ok: false, status: 409, reason: "taken", message: "That number is already connected to another business on Studiowave." };

    let phoneNumberId: string;
    try {
        const found = await findPhoneNumber(wabaId, token, number.e164);
        phoneNumberId = found?.id ?? await addPhoneNumber(wabaId, token, { cc: number.cc, phoneNumber: number.national, verifiedName: name });
        await requestVerificationCode(phoneNumberId, token, opts.method);
    } catch (error) {
        const explained = explainMetaError(error);
        console.error("[whatsapp] own number: send code failed", number.e164.slice(0, -4) + "****", error instanceof Error ? error.message : error);
        return { ok: false, status: explained.reason === "too_many" ? 429 : 422, ...explained };
    }
    await savePending(db, opts.projectId, { agent_id: opts.agentId, phone_number_id: phoneNumberId, phone: number.e164, display_name: name, sent_at: new Date().toISOString(), method: opts.method });
    return { ok: true, phone: number.pretty };
}

/** Step two: check the code, turn the number on, and make it the employee's. */
export async function verifyNumberCode(db: Admin, opts: { projectId: string; organizationId: string; agentId: string; agentName: string; tier: SubscriptionTier; code: string }): Promise<{ ok: true; channel: WhatsAppChannel } | Extract<NumberStep, { ok: false }>> {
    const wabaId = process.env.STUDIO_WABA_ID;
    const token = process.env.META_SYSTEM_USER_TOKEN;
    if (!wabaId || !token) return { ok: false, status: 503, message: "Giving employees their own number isn't switched on yet." };
    const code = opts.code.replace(/\D/g, "");
    if (code.length !== 6) return { ok: false, status: 400, reason: "wrong_code", message: "The code is 6 digits." };
    const found = await pendingRow(db, opts.projectId);
    if (!found || found.pending.agent_id !== opts.agentId || Date.now() - Date.parse(found.pending.sent_at) > PENDING_TTL_MS) {
        return { ok: false, status: 410, reason: "expired", message: "That code has expired. Send a new one." };
    }
    const { pending } = found;

    try {
        await verifyPhoneCode(pending.phone_number_id, token, code);
    } catch (error) {
        const explained = explainMetaError(error);
        // An already-verified number (a retry after a later step failed) carries on.
        if (!/already verified/i.test(error instanceof Error ? error.message : "")) return { ok: false, status: 422, ...explained, ...(explained.reason ? {} : { reason: "wrong_code" as const }) };
    }
    const installed = await ensureWidgetInstallation(db, { projectId: opts.projectId, agentId: opts.agentId, agentName: opts.agentName, tier: opts.tier, audience: "whatsapp" });
    if (!installed.ok) return { ok: false, status: installed.status, message: installed.message };

    // On for the Cloud API, with a two-step PIN we keep (needed to move or re-register it later).
    const pin = String(randomInt(0, 1_000_000)).padStart(6, "0");
    try {
        await registerPhoneNumber(pending.phone_number_id, token, pin);
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (!/already registered/i.test(message)) {
            const explained = explainMetaError(error);
            return { ok: false, status: 422, ...explained };
        }
    }
    // Our account sends its messages to our app's webhook (once; asking again is harmless).
    await subscribeAppToWaba(wabaId, token).catch((error) => console.error("[whatsapp] own number: subscribe failed", error instanceof Error ? error.message : error));
    const existing = await getAgentChannel(db, opts.projectId, opts.agentId);
    const saved = await saveSignupChannel(db, { projectId: opts.projectId, organizationId: opts.organizationId, agentId: opts.agentId, existing, phoneNumberId: pending.phone_number_id, wabaId, accessToken: token, coexistence: false });
    if (!saved.ok) return saved;
    const metadata = { ...saved.channel.metadata, system_user_assigned: true, own_number: true, registration_pin_encrypted: encryptApiKey(pin, opts.organizationId) };
    await db.from("tool_connections").update({ metadata }).eq("id", saved.channel.id);
    await clearPending(db, opts.projectId);
    return { ok: true, channel: { ...saved.channel, metadata } };
}
