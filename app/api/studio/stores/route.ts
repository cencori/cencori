/**
 * /api/studio/stores?project_id=
 *
 * The business's online store (Shopify, WooCommerce) or WhatsApp catalog, for product sync.
 *   GET   which stores can be connected, which are, and how their last sync went
 *   POST  { project_id, action: 'connect', provider }     a sign-in link (Nango)
 *         { project_id, action: 'fetch', provider }       its products, for the review
 *         { project_id, action: 'link', provider, links } after the review: keep it in sync
 *         { project_id, action: 'sync', provider }        sync now
 *         { project_id, action: 'disconnect', provider }  stop syncing and sign out
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { NangoError, createConnectLink, deleteConnection, listNangoIntegrations, listProjectConnections } from '@/lib/integrations/nango';
import { getProjectChannel } from '@/lib/channels/whatsapp';
import { STORES, readStore, removeStoreLink, saveStoreLink, storeLinks, syncStore, type StoreProvider } from '@/lib/embedded/store-sync';

export const maxDuration = 60;

type Admin = ReturnType<typeof createAdminClient>;

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
/** Store product id → catalog product id, as the review worked them out. */
const cleanLinks = (value: unknown): Record<string, string> => Object.fromEntries(Object.entries((value ?? {}) as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && /^p_[a-z0-9]{6,24}$/.test(entry[1])).slice(0, 1_000));
const isProvider = (value: unknown): value is StoreProvider => typeof value === 'string' && value in STORES;

async function canManage(db: Admin, organizationId: string, userId: string) {
    const { data: organization } = await db.from('organizations').select('owner_id').eq('id', organizationId).maybeSingle();
    if (organization?.owner_id === userId) return true;
    const { data: membership } = await db.from('organization_members').select('role').eq('organization_id', organizationId).eq('user_id', userId).maybeSingle();
    return ['owner', 'admin'].includes((membership?.role as string) ?? '');
}

/** The Nango app for each store provider we offer (only those switched on in Nango). */
async function storeIntegrations(): Promise<Partial<Record<StoreProvider, string>>> {
    const catalog = await listNangoIntegrations();
    const found: Partial<Record<StoreProvider, string>> = {};
    for (const provider of ['shopify', 'woocommerce'] as const) {
        const integration = catalog.find((item) => item.provider === provider);
        if (integration) found[provider] = integration.id;
    }
    return found;
}

export async function GET(req: NextRequest) {
    const projectId = req.nextUrl.searchParams.get('project_id') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) return fail('Say which project.');
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    try {
        const [integrations, connections, links, channel] = await Promise.all([storeIntegrations(), listProjectConnections(projectId), storeLinks(db, projectId), getProjectChannel(db, projectId)]);
        const status = (provider: StoreProvider, connected: boolean, broken: boolean) => {
            const link = links.find((item) => item.provider === provider);
            return {
                provider,
                label: STORES[provider].label,
                connected,
                broken,
                syncing: !!link,
                last_synced_at: link?.last_synced_at ?? null,
                last_error: link?.last_error ?? null,
                last_counts: link?.last_counts ?? null,
                products: link ? Object.keys(link.links).length : 0,
            };
        };
        const stores = [
            ...(['shopify', 'woocommerce'] as const).filter((provider) => integrations[provider]).map((provider) => {
                const connection = connections.find((item) => item.integration === integrations[provider]);
                return status(provider, !!connection && !connection.broken, !!connection?.broken);
            }),
            // The catalog on the WhatsApp number, once WhatsApp is connected.
            ...(channel ? [status('whatsapp', true, false)] : []),
        ];
        return NextResponse.json({ stores }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        return fail(error instanceof NangoError ? error.message : 'Couldn\'t load your stores.', 502);
    }
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null) as { project_id?: unknown; action?: unknown; provider?: unknown; links?: unknown } | null;
    if (typeof body?.project_id !== 'string' || !isProvider(body.provider)) return fail('Say which store.');
    const projectId = body.project_id;
    const provider = body.provider;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    if (!await canManage(db, access.organizationId, access.userId)) return fail('Only owners and admins can connect a store.', 403);

    try {
        if (provider === 'whatsapp') {
            const channel = await getProjectChannel(db, projectId);
            if (!channel) return fail('Connect WhatsApp first.', 409);
            if (body.action === 'fetch') return NextResponse.json({ products: await readStore(db, 'whatsapp', 'meta', channel.id) });
            if (body.action === 'link') {
                await saveStoreLink(db, projectId, { provider, integration: 'meta', connection_id: channel.id, links: cleanLinks(body.links), last_synced_at: new Date().toISOString(), last_error: null, last_counts: null });
                return NextResponse.json({ ok: true });
            }
            if (body.action === 'sync') {
                const link = (await storeLinks(db, projectId)).find((item) => item.provider === provider);
                if (!link) return fail('Bring in your products first.', 409);
                const result = await syncStore(db, projectId, { ...link, connection_id: channel.id });
                if (result.last_error) return fail(result.last_error, 502);
                return NextResponse.json({ counts: result.last_counts });
            }
            if (body.action === 'disconnect') {
                await removeStoreLink(db, projectId, provider);
                return NextResponse.json({ ok: true });
            }
            return fail('WhatsApp is connected from its own sheet.');
        }

        const integration = (await storeIntegrations())[provider];
        if (!integration) return fail(`${STORES[provider].label} isn't available yet.`, 404);

        if (body.action === 'connect') {
            const link = await createConnectLink(projectId, integration);
            return NextResponse.json({ url: link.url });
        }

        const connection = (await listProjectConnections(projectId)).find((item) => item.integration === integration);
        if (!connection) return fail(`Connect your ${STORES[provider].label} store first.`, 409);

        if (body.action === 'fetch') {
            const products = await readStore(db, provider, integration, connection.connectionId);
            return NextResponse.json({ products });
        }
        if (body.action === 'link') {
            await saveStoreLink(db, projectId, { provider, integration, connection_id: connection.connectionId, links: cleanLinks(body.links), last_synced_at: new Date().toISOString(), last_error: null, last_counts: null });
            return NextResponse.json({ ok: true });
        }
        if (body.action === 'sync') {
            const link = (await storeLinks(db, projectId)).find((item) => item.provider === provider);
            if (!link) return fail('Bring in your products first.', 409);
            const result = await syncStore(db, projectId, { ...link, connection_id: connection.connectionId });
            if (result.last_error) return fail(result.last_error, 502);
            return NextResponse.json({ counts: result.last_counts });
        }
        if (body.action === 'disconnect') {
            await removeStoreLink(db, projectId, provider);
            await deleteConnection(integration, connection.connectionId).catch(() => undefined);
            return NextResponse.json({ ok: true });
        }
        return fail('Unknown action.');
    } catch (error) {
        console.error('[studio/stores]', error instanceof Error ? error.message : error);
        return fail(error instanceof Error ? error.message : 'The store didn\'t answer. Try again.', 502);
    }
}
