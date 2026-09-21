import type { createAdminClient } from '@/lib/supabaseAdmin';
import { assertSafeOutboundUrl } from '@/lib/security/outbound-url';

type Admin = ReturnType<typeof createAdminClient>;

export type NetworkMode = 'none' | 'allowlist';

export interface NetworkPolicy {
    mode: NetworkMode;
    allowed_hosts: string[];
}

export interface BrowserPolicy {
    enabled: boolean;
}

const DEFAULT_NETWORK: NetworkPolicy = { mode: 'none', allowed_hosts: [] };

function normalizeNetwork(raw: unknown): NetworkPolicy {
    const n = (raw ?? {}) as { mode?: string; allowed_hosts?: string[] };
    return {
        mode: n.mode === 'allowlist' ? 'allowlist' : 'none',
        allowed_hosts: Array.isArray(n.allowed_hosts) ? n.allowed_hosts.filter((h) => typeof h === 'string') : [],
    };
}

function hostMatches(hostname: string, pattern: string): boolean {
    const clean = pattern.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
    const host = hostname.toLowerCase();
    if (clean.startsWith('*.')) return host === clean.slice(2) || host.endsWith(`.${clean.slice(2)}`);
    return host === clean;
}

/**
 * Restrictive intersection of version + installation-overaly network policy.
 * Either side saying `none` (or missing) means deny. Two allowlists intersect.
 */
export function intersectNetworkPolicy(versionPolicy: unknown, installationOverlay: unknown): NetworkPolicy {
    const version = normalizeNetwork((versionPolicy as { network?: unknown } | null)?.network ?? versionPolicy);
    const overlay = (installationOverlay as { network?: unknown } | null)?.network;
    if (!overlay) return version;
    const over = normalizeNetwork(overlay);
    if (version.mode === 'none' || over.mode === 'none') return { mode: 'none', allowed_hosts: [] };
    const hosts = version.allowed_hosts.filter((h) => over.allowed_hosts.some((o) => hostMatches(h.replace(/^https?:\/\//, '').split('/')[0], o) || hostMatches(o.replace(/^https?:\/\//, '').split('/')[0], h)));
    return { mode: 'allowlist', allowed_hosts: hosts };
}

export interface EgressDecision {
    allowed: boolean;
    host: string | null;
    reason: string;
}

/**
 * Default-deny egress check: the URL must be http(s) without credentials,
 * pass outbound safety (private/loopback/metadata/DNS-rebinding), and match
 * the effective allowlist. Connector invocations to canonical provider
 * origins (e.g. Gmail) are not arbitrary egress and bypass this check.
 */
export async function checkEgress(rawUrl: string, policy: NetworkPolicy): Promise<EgressDecision> {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        return { allowed: false, host: null, reason: 'URL is invalid' };
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        return { allowed: false, host: null, reason: 'Only HTTP and HTTPS URLs are allowed' };
    }
    if (url.username || url.password) {
        return { allowed: false, host: url.hostname, reason: 'URLs containing credentials are not allowed' };
    }
    if (policy.mode !== 'allowlist' || !policy.allowed_hosts.some((h) => hostMatches(url.hostname, h))) {
        return { allowed: false, host: url.hostname, reason: 'Host is not in the effective network allowlist (default-deny)' };
    }
    try {
        await assertSafeOutboundUrl(url);
    } catch (e) {
        return { allowed: false, host: url.hostname, reason: e instanceof Error ? e.message : 'Unsafe destination' };
    }
    return { allowed: true, host: url.hostname, reason: 'allowlisted' };
}

/** Resolve the effective network policy for an action via run → installation → version. */
export async function resolveActionNetworkPolicy(
    supabase: Admin,
    action: { project_id: string; run_id?: string | null; approval_policy?: Record<string, unknown> },
): Promise<NetworkPolicy> {
    try {
        const runId = (action.run_id as string | null) ?? (action.approval_policy?.run_id as string | null) ?? null;
        if (!runId) return DEFAULT_NETWORK;
        // Every hop is project-scoped: an action must never borrow another
        // project's allowlist through a foreign run_id.
        const { data: run } = await supabase.from('embedded_runs').select('installation_id').eq('project_id', action.project_id).eq('id', runId).maybeSingle();
        const installationId = (run as { installation_id?: string | null } | null)?.installation_id;
        if (!installationId) return DEFAULT_NETWORK;
        const { data: ins } = await supabase.from('agent_installations').select('agent_version_id, overlay_config').eq('project_id', action.project_id).eq('id', installationId).maybeSingle();
        const versionId = (ins as { agent_version_id?: string | null } | null)?.agent_version_id;
        if (!versionId) return DEFAULT_NETWORK;
        const { data: version } = await supabase.from('agent_versions').select('config_json, project_id').eq('id', versionId).maybeSingle();
        if (!version || (version as { project_id?: string }).project_id !== action.project_id) return DEFAULT_NETWORK;
        const manifest = ((version as { config_json?: Record<string, unknown> } | null)?.config_json ?? {}) as { policy?: { network?: unknown } };
        const overlay = ((ins as { overlay_config?: Record<string, unknown> } | null)?.overlay_config ?? {}) as { network?: unknown };
        return intersectNetworkPolicy(manifest.policy, overlay);
    } catch {
        return DEFAULT_NETWORK;
    }
}
