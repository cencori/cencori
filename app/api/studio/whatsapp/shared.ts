import type { NextRequest } from 'next/server';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabaseAdmin';
import type { SubscriptionTier } from '@/lib/entitlements';
import { finishSignup, type SignupState } from '@/lib/channels/whatsapp-signup';
import { studioOrigin } from '@/lib/studio/routing';

/** Where Meta returns to: Studio's own address, so the owner's sign-in comes along. */
export function studioCallbackUrl(req: NextRequest): string {
    return `${studioOrigin(req.headers.get('host') ?? 'studio.cencori.com')}/api/studio/whatsapp/callback`;
}

/** Only these Studio pages can be returned to. */
export function returnPath(value: string | null | undefined): '/' | '/setup' {
    return value === '/setup' ? '/setup' : '/';
}

/** Back to Studio (Home or setup) with how it went (?whatsapp=connected or failed, and why). */
export function studioHome(req: NextRequest, path: '/' | '/setup' = '/') {
    const origin = studioOrigin(req.headers.get('host') ?? 'studio.cencori.com');
    return (outcome: 'connected' | 'failed', message?: string) => {
        const params = new URLSearchParams({ whatsapp: outcome, via: 'meta', ...(message ? { message: message.slice(0, 200) } : {}) });
        return `${origin}${path}?${params}`;
    };
}

/**
 * The mobile app's link scheme. Meta only returns to https addresses, so the
 * callback sends the phone on to `<scheme>://whatsapp?…`, which the app's
 * sign-in window is waiting for. Set STUDIO_APP_SCHEME once the app's name is settled.
 */
export function appScheme(): string {
    return process.env.STUDIO_APP_SCHEME || 'cencori-studio';
}

/** Back to the app with how it went: failed (and why), or a handoff for it to finish with. */
export function appReturn(outcome: 'failed' | 'handoff', value?: string): string {
    const params = new URLSearchParams(outcome === 'failed'
        ? { outcome, ...(value ? { message: value.slice(0, 200) } : {}) }
        : { outcome, handoff: value ?? '' });
    return `${appScheme()}://whatsapp?${params}`;
}

/**
 * What the app hands back to POST /api/studio/whatsapp/finish: Meta's code,
 * the signed state and the address Meta came back to, sealed (AES-256-GCM) so
 * the code never travels in the clear in the app link. It's only useful to the
 * person who started connecting, signed in to the app: finish checks that.
 */
export interface Handoff {
    code: string;
    state: string;
    redirectUri: string;
}

/** Meta's codes are short-lived; so is the handoff. */
const HANDOFF_TTL_MS = 10 * 60_000;

function handoffKey(): Buffer | null {
    const secret = process.env.META_APP_SECRET;
    return secret ? createHash('sha256').update(`whatsapp-handoff:${secret}`).digest() : null;
}

export function sealHandoff(handoff: Handoff, now = Date.now()): string | null {
    const key = handoffKey();
    if (!key) return null;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const sealed = Buffer.concat([cipher.update(JSON.stringify({ ...handoff, e: now + HANDOFF_TTL_MS }), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), sealed]).toString('base64url');
}

export function openHandoff(value: unknown, now = Date.now()): Handoff | null {
    const key = handoffKey();
    if (!key || typeof value !== 'string' || value.length > 4000) return null;
    try {
        const raw = Buffer.from(value, 'base64url');
        if (raw.length < 29) return null;
        const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
        decipher.setAuthTag(raw.subarray(12, 28));
        const opened = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')) as Partial<Handoff> & { e?: number };
        if (typeof opened.e !== 'number' || opened.e <= now) return null;
        if (typeof opened.code !== 'string' || typeof opened.state !== 'string' || typeof opened.redirectUri !== 'string') return null;
        return { code: opened.code, state: opened.state, redirectUri: opened.redirectUri };
    } catch {
        return null;
    }
}

/**
 * Connect the number Meta's signup returned, for the person who started it
 * (already checked by the caller to be state.u, with access to state.p).
 */
export async function connectFromSignup(opts: {
    state: SignupState;
    userId: string;
    organizationId: string;
    code: string;
    redirectUri: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
    const { state, userId, organizationId } = opts;
    const db = createAdminClient();
    const [{ data: agent }, { data: organization }, { data: membership }] = await Promise.all([
        db.from('agents').select('id, name').eq('project_id', state.p).eq('id', state.a).maybeSingle(),
        db.from('organizations').select('owner_id, subscription_tier').eq('id', organizationId).maybeSingle(),
        db.from('organization_members').select('role').eq('organization_id', organizationId).eq('user_id', userId).maybeSingle(),
    ]);
    if (!agent) return { ok: false, message: 'That assistant isn’t in this business any more.' };
    const canManage = organization?.owner_id === userId || ['owner', 'admin'].includes((membership?.role as string) ?? '');
    if (!canManage) return { ok: false, message: 'Only owners and admins can connect WhatsApp.' };

    const saved = await finishSignup(db, {
        projectId: state.p,
        organizationId,
        agentId: state.a,
        agentName: agent.name as string,
        tier: ((organization?.subscription_tier as string) || 'free') as SubscriptionTier,
        code: opts.code,
        coexistence: state.c,
        redirectUri: opts.redirectUri,
    });
    return saved.ok ? { ok: true } : { ok: false, message: saved.message };
}
