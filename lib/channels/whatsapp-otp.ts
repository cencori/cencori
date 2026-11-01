import "server-only";

import { safeOutboundFetch } from "@/lib/security/outbound-url";
import { META_GRAPH_VERSION } from "@/lib/channels/whatsapp";

/**
 * Sign-in codes on WhatsApp, from Studiowave's own number: an approved
 * "authentication" template with a copy-code button (Meta writes the words;
 * we fill in the code). Sent with our system user's token from the number in
 * STUDIO_WHATSAPP_SENDER_ID, on our own account (STUDIO_WABA_ID), which is
 * also where the template lives (created the first time it's missing).
 */

const TEMPLATE = { name: "studiowave_sign_in_code", language: "en" };
const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

async function graph<T>(method: string, path: string, token: string, body?: unknown): Promise<T> {
    const response = await safeOutboundFetch(`${GRAPH}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15_000),
    });
    const json = await response.json().catch(() => null) as (T & { error?: { message?: string; code?: number } }) | null;
    if (!response.ok) throw Object.assign(new Error(json?.error?.message ?? `WhatsApp request failed (${response.status})`), { code: json?.error?.code });
    return json as T;
}

export function whatsappCodesConfigured(): boolean {
    return !!process.env.STUDIO_WHATSAPP_SENDER_ID && !!process.env.STUDIO_WABA_ID && !!process.env.META_SYSTEM_USER_TOKEN;
}

/** Make sure the template exists on our account (Meta approves authentication templates in minutes). */
export async function ensureCodeTemplate(): Promise<string> {
    const wabaId = process.env.STUDIO_WABA_ID!;
    const token = process.env.META_SYSTEM_USER_TOKEN!;
    const found = await graph<{ data?: Array<{ name?: string; status?: string }> }>("GET", `/${wabaId}/message_templates?name=${TEMPLATE.name}&fields=name,status`, token);
    const existing = found.data?.find((template) => template.name === TEMPLATE.name);
    if (existing) return existing.status ?? "PENDING";
    const created = await graph<{ status?: string }>("POST", `/${wabaId}/message_templates`, token, {
        name: TEMPLATE.name,
        language: TEMPLATE.language,
        category: "AUTHENTICATION",
        components: [
            { type: "BODY", add_security_recommendation: true },
            { type: "FOOTER", code_expiration_minutes: 10 },
            { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Copy code" }] },
        ],
    });
    return created.status ?? "PENDING";
}

/** Send a sign-in code to a number on WhatsApp ("+2348012345678"). Throws with a reason people can read. */
export async function sendWhatsAppCode(phoneNumber: string, code: string): Promise<void> {
    if (!whatsappCodesConfigured()) throw new Error("Signing in with a phone number isn't switched on yet.");
    const to = phoneNumber.replace(/\D/g, "");
    const send = () => graph("POST", `/${process.env.STUDIO_WHATSAPP_SENDER_ID}/messages`, process.env.META_SYSTEM_USER_TOKEN!, {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
            name: TEMPLATE.name,
            language: { code: TEMPLATE.language },
            components: [
                { type: "body", parameters: [{ type: "text", text: code }] },
                { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
            ],
        },
    });
    try {
        await send();
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        // The template isn't there (or approved) yet: ask for it, and say so plainly.
        if (/template/i.test(message)) {
            await ensureCodeTemplate().catch(() => undefined);
            throw new Error("We can't send codes on WhatsApp just yet. Try again in a few minutes.");
        }
        if (/not a valid whatsapp|recipient|131026|incapable/i.test(message)) throw new Error("That number isn't on WhatsApp.");
        console.error("[whatsapp-otp] send failed", error instanceof Error ? error.message : error);
        throw new Error("Couldn't send the code on WhatsApp. Try again.");
    }
}

/** The placeholder email a phone-only account carries until its owner adds one: never delivered to. */
export const phoneEmail = (phoneNumber: string) => `p${phoneNumber.replace(/\D/g, "")}@phone.invalid`;
export const isPhoneEmail = (email: string | null | undefined) => !!email && /@phone\.invalid$/i.test(email);
