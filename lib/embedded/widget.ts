import crypto from 'crypto';
import type { createAdminClient } from '@/lib/supabaseAdmin';
import type { SubscriptionTier } from '@/lib/entitlements';
import { tokenSecret } from './client-tokens';

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Website widget: an agent embedded on a customer's site with one script tag.
 * Visitors are anonymous, so each widget runs through its own "website
 * visitors" tenant and a stable-channel installation of the agent; turns go
 * through the regular Sessions API with a short-lived client token.
 */

export const WIDGET_KEY_PREFIX = 'cwk_';
export const WIDGET_MAX_ORIGINS = 20;
/** Turns in one widget conversation before the visitor must start another. */
export const WIDGET_MAX_TURNS = 40;
export const WIDGET_TURNS_PER_MINUTE = 8;
/** New conversations one visitor IP may open per hour, per widget. */
export const WIDGET_SESSIONS_PER_IP_PER_HOUR = 20;
const PREVIEW_TTL_SECONDS = 60 * 60;

export interface WidgetAppearance {
    title: string;
    greeting: string;
    launcher_text: string;
    accent: string;
    theme: 'light' | 'dark' | 'auto';
    position: 'right' | 'left';
    /** Card: the orb and heading in one button. Pill: an icon and text in the accent colour. */
    launcher_style: 'card' | 'pill';
}

export interface WidgetRow {
    id: string;
    project_id: string;
    agent_id: string;
    public_key: string;
    enabled: boolean;
    allowed_origins: string[];
    tenant_id: string | null;
    installation_id: string | null;
    appearance: Partial<WidgetAppearance> | null;
    daily_session_cap: number;
    created_at: string;
    updated_at: string;
}

export const WIDGET_COLUMNS = 'id, project_id, agent_id, public_key, enabled, allowed_origins, tenant_id, installation_id, appearance, daily_session_cap, created_at, updated_at';

/** True when the live database hasn't had the widget migration yet. */
export function isMissingWidgetTable(error: { code?: string; message?: string } | null | undefined) {
    return Boolean(error && (error.code === '42P01' || error.code === 'PGRST205' || /agent_widgets/.test(error.message ?? '')));
}

export function generateWidgetKey(): string {
    return `${WIDGET_KEY_PREFIX}${crypto.randomBytes(18).toString('base64url')}`;
}

export function isWidgetKey(value: unknown): value is string {
    return typeof value === 'string' && /^cwk_[A-Za-z0-9_-]{16,64}$/.test(value);
}

export function sanitizeAppearance(raw: unknown, agentName = 'Assistant'): WidgetAppearance {
    const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const text = (value: unknown, max: number, fallback: string) => {
        const cleaned = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
        return cleaned || fallback;
    };
    const accent = typeof input.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(input.accent) ? input.accent.toLowerCase() : '#111111';
    return {
        title: text(input.title, 60, agentName.slice(0, 60) || 'Assistant'),
        greeting: text(input.greeting, 300, 'Hi! How can I help?'),
        launcher_text: text(input.launcher_text, 40, 'Need help?'),
        accent,
        theme: input.theme === 'light' || input.theme === 'dark' ? input.theme : 'auto',
        position: input.position === 'left' ? 'left' : 'right',
        launcher_style: input.launcher_style === 'pill' ? 'pill' : 'card',
    };
}

/**
 * Normalize what someone typed into a site origin for frame-ancestors:
 * "example.com" → "https://example.com", "*.example.com" → "https://*.example.com",
 * "http://localhost:5173/page" → "http://localhost:5173". Null when it isn't one.
 */
export function normalizeWidgetOrigin(input: string): string | null {
    let value = input.trim().toLowerCase();
    if (!value) return null;
    const wildcard = /^(https?:\/\/)?\*\./.test(value);
    if (wildcard) value = value.replace('*.', 'wildcard-placeholder.');
    if (!/^https?:\/\//.test(value)) {
        value = `${/^(localhost|127\.0\.0\.1)(:|$|\/)/.test(value) ? 'http' : 'https'}://${value}`;
    }
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return null;
    }
    const host = url.hostname;
    const local = host === 'localhost' || host === '127.0.0.1';
    if (url.protocol === 'http:' && !local) return null;
    if (!local && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return null;
    if (wildcard && host.split('.').length < 3) return null;
    return url.origin.replace('wildcard-placeholder.', '*.');
}

/** Whether a page origin is covered by an allowlist entry (exact, *.subdomain, or :* port). */
export function originAllowed(origin: string | null | undefined, allowed: readonly string[]): boolean {
    if (!origin) return false;
    let page: URL;
    try {
        page = new URL(origin);
    } catch {
        return false;
    }
    return allowed.some((entry) => {
        const match = /^(https?):\/\/(\*\.)?([^:/]+)(?::(\d+|\*))?$/.exec(entry);
        if (!match) return false;
        const [, scheme, wildcard, host, port] = match;
        if (page.protocol !== `${scheme}:`) return false;
        if (port !== '*' && (page.port || '') !== (port ?? '')) return false;
        return wildcard ? page.hostname.endsWith(`.${host}`) : page.hostname === host;
    });
}

/** Cencori's own origins: the console preview frames the widget from these. */
export function appOrigins(): string[] {
    // Studio's setup shows the preview too ("Try it").
    const origins = ['https://cencori.com', 'https://www.cencori.com', 'https://console.cencori.com', 'https://studio.cencori.com'];
    if (process.env.NODE_ENV !== 'production') origins.push('http://localhost:*', 'http://console.localhost:*', 'http://studio.localhost:*');
    return origins;
}

function sign(payload: string) {
    return crypto.createHmac('sha256', tokenSecret()).update(`widget-preview.${payload}`).digest('base64url');
}

/** A console-only token that lets the preview run a widget that isn't turned on. */
export function mintWidgetPreviewToken(widgetId: string): string {
    const exp = Math.floor(Date.now() / 1000) + PREVIEW_TTL_SECONDS;
    const payload = `${widgetId}.${exp}`;
    return `${payload}.${sign(payload)}`;
}

export function verifyWidgetPreviewToken(token: unknown, widgetId: string): boolean {
    if (typeof token !== 'string') return false;
    const [id, exp, sig] = token.split('.');
    if (!id || !exp || !sig || id !== widgetId || Number(exp) * 1000 <= Date.now()) return false;
    const expected = Buffer.from(sign(`${id}.${exp}`));
    const given = Buffer.from(sig);
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

function shareSignature(widget: { id: string; public_key: string }) {
    return crypto.createHmac('sha256', tokenSecret()).update(`widget-share.${widget.id}.${widget.public_key}`).digest('base64url').slice(0, 32);
}

/**
 * The token in an agent's shareable link: the widget key plus a signature, so
 * the public key alone (which sits in customers' page source) can't open the
 * full-page chat. Rotating the widget key retires every link.
 */
export function mintWidgetShareToken(widget: { id: string; public_key: string }): string {
    return `${widget.public_key}.${shareSignature(widget)}`;
}

/** The widget key a share token names, before its signature is checked. */
export function shareTokenKey(token: unknown): string | null {
    if (typeof token !== 'string') return null;
    const key = token.split('.')[0];
    return isWidgetKey(key) ? key : null;
}

export function verifyWidgetShareToken(token: unknown, widget: { id: string; public_key: string }): boolean {
    if (typeof token !== 'string') return false;
    const [key, sig] = token.split('.');
    if (!key || !sig || key !== widget.public_key) return false;
    const expected = Buffer.from(shareSignature(widget));
    const given = Buffer.from(sig);
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

/**
 * Make sure the widget has its visitors tenant and a live, stable-channel
 * installation of the agent's published version. Idempotent: reuses what
 * exists and reactivates or repoints it.
 */
export async function ensureWidgetInstallation(
    db: Admin,
    opts: { projectId: string; agentId: string; agentName: string; tier: SubscriptionTier; audience?: 'widget' | 'whatsapp' },
): Promise<{ ok: true; tenantId: string; installationId: string } | { ok: false; status: number; message: string }> {
    // Website visitors and WhatsApp customers are each one customer (tenant) of the project.
    const audience = opts.audience ?? 'widget';
    const audienceName = audience === 'whatsapp' ? 'WhatsApp customers' : 'website visitors';
    const { data: agent } = await db.from('agents').select('stable_version_id').eq('project_id', opts.projectId).eq('id', opts.agentId).maybeSingle();
    const stableId = (agent?.stable_version_id as string | null) ?? null;
    if (!stableId) return { ok: false, status: 409, message: `Publish this agent before putting it on ${audience === 'whatsapp' ? 'WhatsApp' : 'a website'}.` };
    const { data: version } = await db.from('agent_versions').select('id, status, config_json, requirements_json').eq('project_id', opts.projectId).eq('id', stableId).maybeSingle();
    if (!version || version.status !== 'published') return { ok: false, status: 409, message: 'Published agent version not found.' };

    // Website visitors bring no connections or customer knowledge of their own.
    const requirements = (version.requirements_json ?? {}) as { connections?: unknown[]; knowledge?: unknown[] };
    const config = (version.config_json ?? {}) as Record<string, unknown>;
    const { normalizeManifest } = await import('./manifest');
    const manifest = normalizeManifest(config);
    if (requirements.connections?.length || requirements.knowledge?.length || manifest.connection_requirements.length || manifest.mcp_tools.length || (Array.isArray(config.knowledge_refs) && config.knowledge_refs.length)) {
        return { ok: false, status: 422, message: `This agent needs customer connections or knowledge, which ${audienceName} don’t have.` };
    }

    const externalId = `${audience}:${opts.agentId}`;
    const { data: existingTenant, error: tenantLookupError } = await db.from('platform_tenants').select('id, status').eq('project_id', opts.projectId).eq('external_id', externalId).maybeSingle();
    if (tenantLookupError) return { ok: false, status: 502, message: 'Could not check the website visitors customer.' };
    let tenantId = (existingTenant?.id as string | undefined) ?? null;
    if (existingTenant && existingTenant.status !== 'active') {
        const { error } = await db.from('platform_tenants').update({ status: 'active' }).eq('id', existingTenant.id as string);
        if (error) return { ok: false, status: 502, message: 'Could not reactivate the website visitors customer.' };
    }
    if (!tenantId) {
        const { checkTenantCap } = await import('./limits');
        const cap = await checkTenantCap(db, opts.projectId, opts.tier);
        if (!cap.ok) return { ok: false, status: 402, message: `${cap.message}. ${audience === 'whatsapp' ? 'WhatsApp' : 'The website widget'} counts as one customer.` };
        const { data, error } = await db.from('platform_tenants')
            .insert({ project_id: opts.projectId, name: `${opts.agentName} · ${audienceName}`.slice(0, 120), external_id: externalId, status: 'active' })
            .select('id').single();
        if (error || !data) {
            const { data: raced } = await db.from('platform_tenants').select('id').eq('project_id', opts.projectId).eq('external_id', externalId).maybeSingle();
            if (!raced) return { ok: false, status: 502, message: 'Could not create the website visitors customer.' };
            tenantId = raced.id as string;
        } else {
            tenantId = data.id as string;
        }
    }

    const { data: existingInstall, error: installLookupError } = await db.from('agent_installations').select('id').eq('project_id', opts.projectId).eq('tenant_id', tenantId).eq('agent_id', opts.agentId).maybeSingle();
    if (installLookupError) return { ok: false, status: 502, message: 'Could not check the widget installation.' };
    if (existingInstall) {
        const { error } = await db.from('agent_installations')
            .update({ status: 'active', update_channel: 'stable', agent_version_id: stableId })
            .eq('id', existingInstall.id as string);
        if (error) return { ok: false, status: 502, message: 'Could not update the widget installation.' };
        return { ok: true, tenantId, installationId: existingInstall.id as string };
    }
    const { checkInstallationCap } = await import('./limits');
    const cap = await checkInstallationCap(db, tenantId, opts.tier);
    if (!cap.ok) return { ok: false, status: 402, message: cap.message };
    const { data: installed, error: installError } = await db.from('agent_installations')
        .insert({ project_id: opts.projectId, tenant_id: tenantId, agent_id: opts.agentId, agent_version_id: stableId, update_channel: 'stable', status: 'active' })
        .select('id').single();
    if (installError || !installed) return { ok: false, status: 502, message: 'Could not install the agent for website visitors.' };
    return { ok: true, tenantId, installationId: installed.id as string };
}

/**
 * Pace and length limits for one anonymous widget conversation. Null when the
 * turn may run.
 */
export async function checkWidgetTurn(sessionId: string, turnsSoFar: number): Promise<{ code: string; message: string } | null> {
    if (turnsSoFar >= WIDGET_MAX_TURNS) {
        return { code: 'widget_conversation_limit', message: 'This conversation is at its limit. Start a new one.' };
    }
    const { checkCustomRateLimit } = await import('@/lib/rate-limit');
    const pace = await checkCustomRateLimit(`widget_turns:${sessionId}`, WIDGET_TURNS_PER_MINUTE, 60);
    if (!pace.allowed) return { code: 'widget_rate_limited', message: 'You’re sending messages too quickly. Wait a moment and try again.' };
    return null;
}
