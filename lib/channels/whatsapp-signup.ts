import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "crypto";
import type { createAdminClient } from "@/lib/supabaseAdmin";
import type { SubscriptionTier } from "@/lib/entitlements";
import { ensureWidgetInstallation } from "@/lib/embedded/widget";
import { encryptApiKey } from "@/lib/encryption";
import {
    META_GRAPH_VERSION,
    assignSystemUserToWaba,
    exchangeSignupCode,
    getAgentChannel,
    registerPhoneNumber,
    saveSignupChannel,
    signupTargets,
    subscribeAppToWaba,
    type WhatsAppChannel,
} from "@/lib/channels/whatsapp";

/**
 * Finishing Meta's Embedded Signup ("Connect WhatsApp"), however it was
 * started: the console's popup (which reports the number by message) or
 * Studio's full-page redirect (which doesn't, so the token says which).
 */

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Who may connect through Cencori's own Meta app (Embedded Signup) rather than
 * Kapso. Until Meta's App Review grants the WhatsApp permissions advanced
 * access, our signup only works for people with a role on the app, so it's
 * kept to the emails in META_SIGNUP_ALLOWLIST (comma-separated; for recording
 * the review). "*" opens it to everyone once approved; unset, no one.
 */
export function signupAllowlist(): "everyone" | Set<string> {
    const raw = (process.env.META_SIGNUP_ALLOWLIST ?? "").trim();
    if (raw === "*") return "everyone";
    return new Set(raw.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

/** Whether the signed-in user gets our own signup: the allow-list, checked against their email. */
export async function signupAllowed(): Promise<boolean> {
    const allowed = signupAllowlist();
    if (allowed === "everyone") return true;
    if (allowed.size === 0) return false;
    const [{ getAuthUser }, { createServerClient }] = await Promise.all([import("@/lib/auth/get-auth-user"), import("@/lib/supabaseServer")]);
    const { data } = await getAuthUser(await createServerClient()).catch(() => ({ data: { user: null } }));
    const email = data.user?.email?.toLowerCase();
    return !!email && allowed.has(email);
}

/** Our signup's settings, for those it's open to (signupAllowed); null for everyone else, who connect through Kapso. */
export async function signupConfigFor(): Promise<ReturnType<typeof signupConfig>> {
    const config = signupConfig();
    return config && await signupAllowed() ? config : null;
}

export function signupConfig() {
    const appId = process.env.META_APP_ID;
    const configId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID;
    return appId && configId && process.env.META_APP_SECRET ? { app_id: appId, config_id: configId, graph_version: META_GRAPH_VERSION } : null;
}

export async function finishSignup(db: Admin, opts: {
    projectId: string;
    organizationId: string;
    agentId: string;
    agentName: string;
    tier: SubscriptionTier;
    code: string;
    coexistence: boolean;
    /** Set for the redirect version: the address Meta came back to. */
    redirectUri?: string;
    phoneNumberId?: string;
    wabaId?: string;
}): Promise<{ ok: true; channel: WhatsAppChannel } | { ok: false; status: number; message: string }> {
    const config = signupConfig();
    if (!config) return { ok: false, status: 503, message: "Connecting WhatsApp isn't set up on this server yet." };

    const installed = await ensureWidgetInstallation(db, { projectId: opts.projectId, agentId: opts.agentId, agentName: opts.agentName, tier: opts.tier, audience: "whatsapp" });
    if (!installed.ok) return { ok: false, status: installed.status, message: installed.message };

    let token: string;
    let phoneNumberId = opts.phoneNumberId;
    let wabaId = opts.wabaId;
    try {
        token = await exchangeSignupCode(opts.code, config.app_id, process.env.META_APP_SECRET!, opts.redirectUri);
        if (!phoneNumberId || !wabaId) ({ phoneNumberId, wabaId } = await signupTargets(token, config.app_id, process.env.META_APP_SECRET!));
        await subscribeAppToWaba(wabaId, token);
    } catch (error) {
        return { ok: false, status: 502, message: `Meta didn't finish connecting the number: ${error instanceof Error ? error.message : "unknown error"}` };
    }
    // A new number has to be turned on for the Cloud API, with a two-step PIN we keep.
    let pinEncrypted: string | null = null;
    if (!opts.coexistence) {
        const pin = String(randomInt(0, 1_000_000)).padStart(6, "0");
        try {
            await registerPhoneNumber(phoneNumberId, token, pin);
            pinEncrypted = encryptApiKey(pin, opts.organizationId);
        } catch (error) {
            // Already registered (a reconnect) is fine; anything else is surfaced.
            const message = error instanceof Error ? error.message : "unknown error";
            if (!/already registered|registered/i.test(message)) return { ok: false, status: 502, message: `Meta didn't turn the number on: ${message}` };
        }
    }

    const existing = await getAgentChannel(db, opts.projectId, opts.agentId);
    const saved = await saveSignupChannel(db, { projectId: opts.projectId, organizationId: opts.organizationId, agentId: opts.agentId, existing, phoneNumberId, wabaId, accessToken: token, coexistence: opts.coexistence });
    if (!saved.ok) return saved;
    // The signup token lasts 60 days; Cencori's system user doesn't expire. Best-effort:
    // without it the stored token is used, and the console shows when it runs out.
    let systemUserAssigned = false;
    const systemUserId = process.env.META_SYSTEM_USER_ID;
    const systemUserToken = process.env.META_SYSTEM_USER_TOKEN;
    if (systemUserId && systemUserToken) {
        try {
            await assignSystemUserToWaba(wabaId, systemUserId, systemUserToken);
            systemUserAssigned = true;
        } catch (error) {
            console.error("[whatsapp] system user assignment failed", error instanceof Error ? error.message : error);
        }
    }
    await db.from("tool_connections").update({
        metadata: {
            ...saved.channel.metadata,
            system_user_assigned: systemUserAssigned,
            token_expires_at: new Date(Date.now() + 60 * 86_400_000).toISOString(),
            ...(pinEncrypted ? { registration_pin_encrypted: pinEncrypted } : {}),
        },
    }).eq("id", saved.channel.id);
    saved.channel.metadata.system_user_assigned = systemUserAssigned;
    return saved;
}

/**
 * The redirect version carries who started it through Meta and back, signed
 * so it can't be swapped: project, assistant, user, coexistence, where to
 * return to in Studio, and expiry.
 */
export type SignupState = { p: string; a: string; u: string; c: boolean; e: number; /** Studio page to return to: Home or setup. */ r?: "/" | "/setup"; /** Started from the mobile app: return to it, which finishes connecting. */ m?: "app" };

function sign(body: string): string {
    return createHmac("sha256", `whatsapp-signup:${process.env.META_APP_SECRET ?? ""}`).update(body).digest("base64url");
}

export function signState(state: Omit<SignupState, "e">, ttlMs = 30 * 60_000): string {
    const body = Buffer.from(JSON.stringify({ ...state, e: Date.now() + ttlMs })).toString("base64url");
    return `${body}.${sign(body)}`;
}

export function readState(value: string | null): SignupState | null {
    if (!value || !process.env.META_APP_SECRET) return null;
    const [body, mac] = value.split(".");
    if (!body || !mac) return null;
    const expected = Buffer.from(sign(body));
    const given = Buffer.from(mac);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    try {
        const state = JSON.parse(Buffer.from(body, "base64url").toString()) as SignupState;
        return state.e > Date.now() ? state : null;
    } catch {
        return null;
    }
}

/** Meta's signup as a page (not a popup), for Studio installed on a phone. */
export function signupDialogUrl(opts: { redirectUri: string; state: string; coexistence: boolean }): string | null {
    const config = signupConfig();
    if (!config) return null;
    const params = new URLSearchParams({
        client_id: config.app_id,
        config_id: config.config_id,
        redirect_uri: opts.redirectUri,
        state: opts.state,
        response_type: "code",
        override_default_response_type: "true",
        extras: JSON.stringify({
            setup: {},
            sessionInfoVersion: "3",
            // Keep using the WhatsApp Business app on the same number.
            ...(opts.coexistence ? { featureType: "whatsapp_business_app_onboarding" } : {}),
        }),
    });
    return `https://www.facebook.com/${config.graph_version}/dialog/oauth?${params}`;
}
