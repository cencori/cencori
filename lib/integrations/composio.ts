/**
 * Composio: sign-in to apps Nango doesn't cover well (Square, Wix, and Shopify
 * once there's a Shopify app), and calls to their own APIs through Composio's
 * proxy with the business's credentials attached.
 *
 * Kept behind this one module, as nango.ts is: the rest of Cencori talks of
 * "connections" and "a store's API", so changing provider touches only this.
 *
 * - A connection belongs to a project: its Composio user id is
 *   `project:<projectId>`. One per app per project.
 * - Each app needs an auth config in our Composio account; ones Composio
 *   signs in for itself (managed auth: Square) are made on first use.
 */

import { safeOutboundFetch } from '@/lib/security/outbound-url';

const COMPOSIO_API = 'https://backend.composio.dev/api/v3';
const REQUEST_TIMEOUT_MS = 20_000;

export class ComposioError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
    }
}

export function composioConfigured(): boolean {
    return !!process.env.COMPOSIO_API_KEY;
}

async function composio<T>(method: string, path: string, body?: unknown): Promise<T> {
    const key = process.env.COMPOSIO_API_KEY;
    if (!key) throw new ComposioError('Store connections aren\'t set up on this server (COMPOSIO_API_KEY).', 503);
    const response = await safeOutboundFetch(`${COMPOSIO_API}${path}`, {
        method,
        headers: { 'x-api-key': key, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();
    let json: unknown = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = null;
    }
    if (!response.ok) {
        const error = json as { message?: string; error?: { message?: string } } | null;
        throw new ComposioError(error?.error?.message ?? error?.message ?? `Composio request failed (${response.status})`, response.status);
    }
    return json as T;
}

const userOf = (projectId: string) => `project:${projectId}`;

/** Each app's auth config id, found or (for apps Composio signs in for itself) made once per server. */
const authConfigs = new Map<string, string>();

async function authConfigFor(toolkit: string): Promise<string> {
    const cached = authConfigs.get(toolkit);
    if (cached) return cached;
    const { items } = await composio<{ items?: Array<{ id: string; toolkit?: { slug?: string }; status?: string }> }>('GET', '/auth_configs?limit=200');
    const found = (items ?? []).find((item) => item.toolkit?.slug === toolkit && item.status !== 'DISABLED');
    let id = found?.id;
    if (!id) {
        const created = await composio<{ auth_config?: { id?: string } }>('POST', '/auth_configs', {
            toolkit: { slug: toolkit },
            auth_config: { type: 'use_composio_managed_auth', name: `Cencori Studio · ${toolkit}` },
        });
        id = created.auth_config?.id;
    }
    if (!id) throw new ComposioError(`Couldn't set up ${toolkit} sign-in.`, 502);
    authConfigs.set(toolkit, id);
    return id;
}

/** A sign-in link for one app; the connection it makes belongs to this project. Comes back to `callbackUrl`. */
export async function createComposioLink(projectId: string, toolkit: string, callbackUrl: string): Promise<{ url: string; connectionId: string }> {
    const link = await composio<{ redirect_url?: string; connected_account_id?: string }>('POST', '/connected_accounts/link', {
        auth_config_id: await authConfigFor(toolkit),
        user_id: userOf(projectId),
        callback_url: callbackUrl,
    });
    if (!link.redirect_url || !link.connected_account_id) throw new ComposioError('Couldn\'t start signing in.', 502);
    return { url: link.redirect_url, connectionId: link.connected_account_id };
}

export interface ComposioConnection {
    connectionId: string;
    toolkit: string;
    /** ACTIVE once signed in; INITIALIZING while the sign-in is open; others mean sign in again. */
    status: string;
    createdAt: string;
}

/** The project's app connections, newest first. */
export async function listComposioConnections(projectId: string): Promise<ComposioConnection[]> {
    const user = userOf(projectId);
    const { items } = await composio<{ items?: Array<{ id: string; status?: string; user_id?: string; created_at?: string; toolkit?: { slug?: string } }> }>('GET', `/connected_accounts?user_ids=${encodeURIComponent(user)}&limit=100`);
    return (items ?? [])
        // Filtered by Composio already; checked again so another project's connection can't show.
        .filter((item) => item.user_id === user)
        .map((item) => ({ connectionId: item.id, toolkit: item.toolkit?.slug ?? '', status: item.status ?? '', createdAt: item.created_at ?? '' }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The project's signed-in connection to one app, if any. */
export async function activeComposioConnection(projectId: string, toolkit: string): Promise<ComposioConnection | null> {
    return (await listComposioConnections(projectId)).find((item) => item.toolkit === toolkit && item.status === 'ACTIVE') ?? null;
}

export async function deleteComposioConnection(connectionId: string): Promise<void> {
    await composio('DELETE', `/connected_accounts/${encodeURIComponent(connectionId)}`);
}

/**
 * A call to a connected app's own API through Composio, which adds the
 * business's credentials. `endpoint` is the app's path, e.g. `/v2/catalog/list`.
 */
export async function composioProxy<T>(projectId: string, connectionId: string, method: 'GET' | 'POST', endpoint: string, body?: unknown): Promise<T> {
    const result = await composio<{ data?: T; status?: number; error?: string | null }>('POST', '/tools/execute/proxy', {
        // Our Composio project requires the owner with the connection (a second check it's this business's).
        user_id: userOf(projectId),
        connected_account_id: connectionId,
        endpoint,
        method,
        ...(body ? { body } : {}),
    });
    if (result.status && result.status >= 400) throw new ComposioError(result.error || `The store didn't answer (${result.status})`, result.status);
    return result.data as T;
}
