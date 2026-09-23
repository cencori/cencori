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

/** Canonical host pattern. No paths, credentials, non-HTTPS schemes, or implicit non-default ports. */
export function canonicalAllowedHost(raw: string): string | null {
    const value = raw.trim().toLowerCase();
    const hostPort = value.startsWith('https://') ? value.slice('https://'.length) : value;
    if (hostPort.includes('://') || /[/?#@]/.test(hostPort)) return null;
    const match = hostPort.match(/^((?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*)(?::([0-9]{1,5}))?$/);
    if (!match) return null;
    const host = match[1];
    if (host.split('.').some((part) => !part || part.startsWith('-') || part.endsWith('-'))) return null;
    const port = match[2] ? Number(match[2]) : 443;
    if (port < 1 || port > 65535) return null;
    return `${host}${port === 443 ? '' : `:${port}`}`;
}

function normalizeNetwork(raw: unknown): NetworkPolicy {
    const n = (raw ?? {}) as { mode?: string; allowed_hosts?: string[] };
    return {
        mode: n.mode === 'allowlist' ? 'allowlist' : 'none',
        allowed_hosts: Array.isArray(n.allowed_hosts) ? n.allowed_hosts
            .filter((h): h is string => typeof h === 'string')
            .map(canonicalAllowedHost)
            .filter((h): h is string => h !== null) : [],
    };
}

function hostMatches(hostname: string, pattern: string, port = 443): boolean {
    const canonical = canonicalAllowedHost(pattern);
    if (!canonical) return false;
    const [clean, patternPort] = canonical.split(':');
    if (port !== Number(patternPort ?? 443)) return false;
    const host = hostname.toLowerCase();
    if (clean.startsWith('*.')) return host === clean.slice(2) || host.endsWith(`.${clean.slice(2)}`);
    return host === clean;
}

function narrowerHostPattern(a: string, b: string): string | null {
    const first = canonicalAllowedHost(a);
    const second = canonicalAllowedHost(b);
    if (!first || !second) return null;
    const [firstHost, firstPort] = first.split(':');
    const [secondHost, secondPort] = second.split(':');
    if ((firstPort ?? '443') !== (secondPort ?? '443')) return null;
    const firstWildcard = firstHost.startsWith('*.');
    const secondWildcard = secondHost.startsWith('*.');
    if (firstWildcard && secondWildcard) {
        if (first === second) return first;
        if (firstHost.slice(2).endsWith(`.${secondHost.slice(2)}`)) return first;
        if (secondHost.slice(2).endsWith(`.${firstHost.slice(2)}`)) return second;
        return null;
    }
    const port = Number(firstPort ?? 443);
    if (firstWildcard) return hostMatches(secondHost, first, port) ? second : null;
    if (secondWildcard) return hostMatches(firstHost, second, port) ? first : null;
    return first === second ? first : null;
}

/**
 * Restrictive intersection of version + installation-overaly browser grants.
 * Either side denying (or missing) means denied — an overlay can only narrow,
 * never widen, the version's browser grant.
 */
export function intersectBrowserEnabled(versionPolicy: unknown, installationOverlay: unknown): boolean {
    const version = (versionPolicy as { browser?: { enabled?: boolean } } | null)?.browser?.enabled === true;
    const overlay = (installationOverlay as { browser?: { enabled?: boolean } } | null)?.browser;
    if (!version) return false;
    if (overlay === undefined) return true;
    return overlay.enabled === true;
}
export function intersectNetworkPolicy(versionPolicy: unknown, installationOverlay: unknown): NetworkPolicy {
    const version = normalizeNetwork((versionPolicy as { network?: unknown } | null)?.network ?? versionPolicy);
    const overlay = (installationOverlay as { network?: unknown } | null)?.network;
    if (!overlay) return version;
    const over = normalizeNetwork(overlay);
    if (version.mode === 'none' || over.mode === 'none') return { mode: 'none', allowed_hosts: [] };
    const hosts = [...new Set(version.allowed_hosts.flatMap((h) => over.allowed_hosts
        .map((o) => narrowerHostPattern(h, o))
        .filter((candidate): candidate is string => candidate !== null)))];
    return { mode: 'allowlist', allowed_hosts: hosts };
}

export interface EgressDecision {
    allowed: boolean;
    host: string | null;
    reason: string;
}

/**
 * Default-deny egress check: the URL must be HTTPS without credentials,
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
    if (url.protocol !== 'https:') {
        return { allowed: false, host: null, reason: 'Only HTTPS URLs are allowed' };
    }
    if (url.username || url.password) {
        return { allowed: false, host: url.hostname, reason: 'URLs containing credentials are not allowed' };
    }
    if (policy.mode !== 'allowlist' || !policy.allowed_hosts.some((h) => hostMatches(url.hostname, h, Number(url.port || 443)))) {
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
