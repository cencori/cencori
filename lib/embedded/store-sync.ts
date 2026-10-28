/**
 * Live product sync with a business's online store (Shopify, WooCommerce,
 * connected through Nango) or the catalog on its WhatsApp number (read with
 * the number's own connection). The first import goes through Studio's review
 * like any other source, and records which catalog product each store
 * product became. After that, every sync (hourly, and on "Sync now") brings
 * in prices, stock and new products by itself, and hides products the store
 * no longer sells (never deletes them: orders still point at them).
 *
 * Kept per project on `tool_connections` (connector_slug 'store_sync').
 */

import type { createAdminClient } from '@/lib/supabaseAdmin';
import { nangoProxy } from '@/lib/integrations/nango';
import { getCatalog, saveProducts } from '@/lib/embedded/catalog';
import { PRODUCTS_MAX, newProductId, parsePrice, type CatalogProduct } from '@/lib/embedded/catalog-format';
import { productKey } from '@/lib/embedded/catalog-merge';

type Admin = ReturnType<typeof createAdminClient>;

export const STORE_SYNC_SLUG = 'store_sync';
export type StoreProvider = 'shopify' | 'woocommerce' | 'square' | 'whatsapp';
export const STORES: Record<StoreProvider, { label: string }> = {
    shopify: { label: 'Shopify' },
    woocommerce: { label: 'WooCommerce' },
    square: { label: 'Square' },
    whatsapp: { label: 'WhatsApp catalog' },
};
/** A store is synced again after this long (the hourly job runs a little more often). */
const SYNC_EVERY_MS = 50 * 60_000;

/** A product as the store has it. */
export interface StoreProduct {
    externalId: string;
    name: string;
    price: number;
    description: string;
    options: string;
    stock: number | null;
}

export interface StoreLink {
    provider: StoreProvider;
    /** The Nango integration id (unique key) and connection. */
    integration: string;
    connection_id: string;
    /** Store product id → catalog product id. */
    links: Record<string, string>;
    last_synced_at: string | null;
    last_error: string | null;
    last_counts: { added: number; updated: number; hidden: number } | null;
}

type SyncRow = { id: string; metadata: { kind: 'store_sync'; stores: StoreLink[] } };

const strip = (html: string | null | undefined) => (html ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().slice(0, 500);

// ── Reading a store ─────────────────────────────────────────────

const SHOPIFY_API = '/admin/api/2025-07/graphql.json';
const SHOPIFY_QUERY = `query Products($cursor: String) {
  products(first: 100, after: $cursor, query: "status:active") {
    pageInfo { hasNextPage endCursor }
    nodes {
      id title description tracksInventory totalInventory
      variants(first: 50) { nodes { title price inventoryQuantity } }
    }
  }
}`;

type ShopifyPage = { data?: { products?: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: Array<{ id: string; title: string; description: string; tracksInventory: boolean; totalInventory: number | null; variants: { nodes: Array<{ title: string; price: string; inventoryQuantity: number | null }> } }> } }; errors?: Array<{ message: string }> };

async function shopifyProducts(integration: string, connectionId: string): Promise<StoreProduct[]> {
    const products: StoreProduct[] = [];
    let cursor: string | null = null;
    do {
        const page: ShopifyPage = await nangoProxy<ShopifyPage>(integration, connectionId, 'POST', SHOPIFY_API, { query: SHOPIFY_QUERY, variables: { cursor } });
        if (page.errors?.length) throw new Error(page.errors[0].message);
        const result = page.data?.products;
        if (!result) break;
        for (const node of result.nodes) {
            const variants = node.variants.nodes.filter((variant) => parsePrice(variant.price) !== null);
            if (!variants.length) continue;
            const prices = variants.map((variant) => parsePrice(variant.price)!);
            const low = Math.min(...prices);
            const named = variants.filter((variant) => variant.title && variant.title !== 'Default Title');
            const samePrice = prices.every((price) => price === low);
            products.push({
                externalId: node.id,
                name: node.title.trim().slice(0, 120),
                price: low,
                description: strip(node.description),
                options: named.map((variant) => (samePrice ? variant.title : `${variant.title} ₦${parsePrice(variant.price)!.toLocaleString('en-NG')}`)).join(', ').slice(0, 200),
                stock: node.tracksInventory ? Math.max(0, node.totalInventory ?? 0) : null,
            });
        }
        cursor = result.pageInfo.hasNextPage ? result.pageInfo.endCursor : null;
    } while (cursor && products.length < PRODUCTS_MAX);
    return products.slice(0, PRODUCTS_MAX);
}

type WooProduct = { id: number; name: string; price: string; regular_price: string; short_description: string; description: string; manage_stock: boolean; stock_quantity: number | null; stock_status: string; attributes?: Array<{ name: string; options?: string[] }> };

async function wooProducts(integration: string, connectionId: string): Promise<StoreProduct[]> {
    const products: StoreProduct[] = [];
    for (let page = 1; page <= Math.ceil(PRODUCTS_MAX / 100); page++) {
        const batch = await nangoProxy<WooProduct[]>(integration, connectionId, 'GET', `/wp-json/wc/v3/products?per_page=100&page=${page}&status=publish`);
        for (const item of batch ?? []) {
            const price = parsePrice(item.price) ?? parsePrice(item.regular_price);
            if (price === null || !item.name) continue;
            products.push({
                externalId: String(item.id),
                name: strip(item.name).slice(0, 120),
                price,
                description: strip(item.short_description || item.description),
                options: (item.attributes ?? []).flatMap((attribute) => attribute.options ?? []).join(', ').slice(0, 200),
                stock: item.manage_stock ? Math.max(0, item.stock_quantity ?? 0) : item.stock_status === 'outofstock' ? 0 : null,
            });
        }
        if (!batch || batch.length < 100) break;
    }
    return products.slice(0, PRODUCTS_MAX);
}

/** The catalog on the business's WhatsApp number: read with the number's own token, not through Nango. */
async function whatsappProducts(db: Admin, channelId: string): Promise<StoreProduct[]> {
    const { getChannelById, channelAccessToken, readWhatsAppCatalog } = await import('@/lib/channels/whatsapp');
    const { decryptApiKey } = await import('@/lib/encryption');
    const channel = await getChannelById(db, channelId);
    if (!channel) throw new Error('Connect WhatsApp first.');
    const { data: project } = await db.from('projects').select('organization_id').eq('id', channel.projectId).maybeSingle();
    const token = channelAccessToken(channel, (value) => {
        try {
            return decryptApiKey(value, (project?.organization_id as string) ?? '');
        } catch {
            return null;
        }
    });
    if (!token) throw new Error('Connect WhatsApp again.');
    const items = await readWhatsAppCatalog(channel, token);
    return items.flatMap((item) => {
        const price = parsePrice(item.price);
        if (price === null || !item.name.trim()) return [];
        return [{
            externalId: item.id,
            name: item.name.trim().slice(0, 120),
            price,
            description: strip(item.description),
            options: '',
            stock: typeof item.inventory === 'number' ? Math.max(0, item.inventory) : /out of stock/i.test(item.availability) ? 0 : null,
        }];
    });
}

type SquareObject = { id: string; is_deleted?: boolean; item_data?: { name?: string; description?: string; variations?: Array<{ id: string; item_variation_data?: { name?: string; price_money?: { amount?: number; currency?: string } } }> } };

/** A Square catalog (through Composio): items, their variations as options, prices (minor units) and stock. */
async function squareProducts(projectId: string, connectionId: string): Promise<StoreProduct[]> {
    const { composioProxy } = await import('@/lib/integrations/composio');
    const items: SquareObject[] = [];
    let cursor: string | null = null;
    do {
        const page: { objects?: SquareObject[]; cursor?: string } = await composioProxy(projectId, connectionId, 'GET', `/v2/catalog/list?types=ITEM${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
        items.push(...(page.objects ?? []).filter((item) => !item.is_deleted && item.item_data?.name));
        cursor = page.cursor ?? null;
    } while (cursor && items.length < PRODUCTS_MAX);

    // Stock, per variation, summed per item (Square counts only what's tracked).
    const variationIds = items.flatMap((item) => (item.item_data?.variations ?? []).map((variation) => variation.id));
    const stock = new Map<string, number>();
    for (let index = 0; index < variationIds.length; index += 100) {
        type Counts = { counts?: Array<{ catalog_object_id: string; quantity?: string; state?: string }> };
        const counts = await composioProxy<Counts>(projectId, connectionId, 'POST', '/v2/inventory/counts/batch-retrieve', { catalog_object_ids: variationIds.slice(index, index + 100), states: ['IN_STOCK'] })
            .catch((): Counts => ({ counts: [] }));
        for (const count of counts.counts ?? []) stock.set(count.catalog_object_id, (stock.get(count.catalog_object_id) ?? 0) + Number(count.quantity ?? 0));
    }

    return items.slice(0, PRODUCTS_MAX).flatMap((item) => {
        const variations = (item.item_data?.variations ?? []).filter((variation) => typeof variation.item_variation_data?.price_money?.amount === 'number');
        if (!variations.length) return [];
        // Square keeps money in the currency's smallest unit (kobo, cents).
        const prices = variations.map((variation) => variation.item_variation_data!.price_money!.amount! / 100);
        const low = Math.min(...prices);
        const named = variations.filter((variation) => variation.item_variation_data?.name && !/^regular$/i.test(variation.item_variation_data.name));
        const tracked = variations.some((variation) => stock.has(variation.id));
        return [{
            externalId: item.id,
            name: item.item_data!.name!.trim().slice(0, 120),
            price: low,
            description: strip(item.item_data!.description),
            options: named.map((variation) => {
                const price = prices[variations.indexOf(variation)];
                const currency = variation.item_variation_data!.price_money!.currency ?? 'NGN';
                return prices.every((each) => each === low) ? variation.item_variation_data!.name! : `${variation.item_variation_data!.name} ${currency === 'NGN' ? '₦' : `${currency} `}${price.toLocaleString('en-NG')}`;
            }).join(', ').slice(0, 200),
            stock: tracked ? variations.reduce((sum, variation) => sum + (stock.get(variation.id) ?? 0), 0) : null,
        }];
    });
}

/**
 * `integration`/`connectionId`: the Nango app and connection; for Square
 * 'composio' and the Composio connection; for WhatsApp 'meta' and the channel id.
 */
export async function readStore(db: Admin, provider: StoreProvider, integration: string, connectionId: string, projectId = ''): Promise<StoreProduct[]> {
    if (provider === 'whatsapp') return whatsappProducts(db, connectionId);
    if (provider === 'square') return squareProducts(projectId, connectionId);
    return provider === 'shopify' ? shopifyProducts(integration, connectionId) : wooProducts(integration, connectionId);
}

// ── Applying a sync ─────────────────────────────────────────────

/**
 * The catalog after a sync: linked products (or ones with the same name)
 * take the store's price, stock, options and description; new store products
 * are added; linked products the store no longer has are hidden.
 */
export function applyStoreSync(existing: CatalogProduct[], store: StoreProduct[], links: Record<string, string>): { products: CatalogProduct[]; links: Record<string, string>; added: number; updated: number; hidden: number } {
    const products = new Map(existing.map((product) => [product.id, product]));
    const byKey = new Map(existing.map((product) => [productKey(product.name), product.id]));
    const next: Record<string, string> = {};
    let added = 0;
    let updated = 0;
    for (const item of store) {
        const id = (links[item.externalId] && products.has(links[item.externalId]) ? links[item.externalId] : null) ?? byKey.get(productKey(item.name)) ?? null;
        const current = id ? products.get(id)! : null;
        if (current) {
            const changed: CatalogProduct = {
                ...current,
                price: item.price,
                stock: item.stock,
                options: item.options || current.options,
                description: item.description || current.description,
                available: true,
            };
            if (JSON.stringify(changed) !== JSON.stringify(current)) {
                products.set(current.id, changed);
                updated++;
            }
            next[item.externalId] = current.id;
        } else if (products.size < PRODUCTS_MAX) {
            const product: CatalogProduct = { id: newProductId(), name: item.name, price: item.price, description: item.description, options: item.options, stock: item.stock, available: true };
            products.set(product.id, product);
            byKey.set(productKey(product.name), product.id);
            next[item.externalId] = product.id;
            added++;
        }
    }
    // Linked before, gone from the store now: hidden from customers, kept for old orders.
    let hidden = 0;
    const kept = new Set(Object.values(next));
    for (const id of Object.values(links)) {
        const product = products.get(id);
        if (product && !kept.has(id) && product.available) {
            products.set(id, { ...product, available: false });
            hidden++;
        }
    }
    return { products: [...products.values()], links: next, added, updated, hidden };
}

// ── Storage ─────────────────────────────────────────────────────

async function syncRow(db: Admin, projectId: string): Promise<SyncRow | null> {
    const { data } = await db.from('tool_connections').select('id, metadata').eq('project_id', projectId).eq('connector_slug', STORE_SYNC_SLUG).limit(1).maybeSingle();
    const metadata = data?.metadata as SyncRow['metadata'] | undefined;
    if (!data || metadata?.kind !== 'store_sync') return null;
    return { id: data.id as string, metadata: { kind: 'store_sync', stores: Array.isArray(metadata.stores) ? metadata.stores : [] } };
}

export async function storeLinks(db: Admin, projectId: string): Promise<StoreLink[]> {
    return (await syncRow(db, projectId))?.metadata.stores ?? [];
}

export async function saveStoreLink(db: Admin, projectId: string, link: StoreLink): Promise<void> {
    const row = await syncRow(db, projectId);
    const stores = [...(row?.metadata.stores ?? []).filter((store) => store.provider !== link.provider), link];
    const metadata = { kind: 'store_sync', stores };
    if (row) await db.from('tool_connections').update({ metadata }).eq('id', row.id);
    else await db.from('tool_connections').insert({ project_id: projectId, connector_slug: STORE_SYNC_SLUG, owner_type: 'platform', status: 'active', metadata });
}

export async function removeStoreLink(db: Admin, projectId: string, provider: StoreProvider): Promise<void> {
    const row = await syncRow(db, projectId);
    if (!row) return;
    await db.from('tool_connections').update({ metadata: { kind: 'store_sync', stores: row.metadata.stores.filter((store) => store.provider !== provider) } }).eq('id', row.id);
}

/** Sync one store into the catalog now. */
export async function syncStore(db: Admin, projectId: string, link: StoreLink): Promise<StoreLink> {
    try {
        const [store, catalog] = await Promise.all([readStore(db, link.provider, link.integration, link.connection_id, projectId), getCatalog(db, projectId)]);
        const result = applyStoreSync(catalog?.metadata.products ?? [], store, link.links);
        if (result.added || result.updated || result.hidden) {
            const saved = await saveProducts(db, projectId, { products: result.products, currency: catalog?.metadata.currency });
            if (!saved.ok) throw new Error(saved.message);
        }
        const next: StoreLink = { ...link, links: result.links, last_synced_at: new Date().toISOString(), last_error: null, last_counts: { added: result.added, updated: result.updated, hidden: result.hidden } };
        await saveStoreLink(db, projectId, next);
        return next;
    } catch (error) {
        const next: StoreLink = { ...link, last_synced_at: new Date().toISOString(), last_error: error instanceof Error ? error.message.slice(0, 300) : 'Sync failed' };
        await saveStoreLink(db, projectId, next);
        return next;
    }
}

/** The hourly job: every linked store not synced in the last 50 minutes. */
export async function syncAllStores(db: Admin, now = Date.now()): Promise<{ synced: number; failed: number }> {
    const { data } = await db.from('tool_connections').select('project_id, metadata').eq('connector_slug', STORE_SYNC_SLUG).limit(2_000);
    let synced = 0;
    let failed = 0;
    for (const row of (data ?? []) as Array<{ project_id: string; metadata: SyncRow['metadata'] | null }>) {
        for (const link of row.metadata?.stores ?? []) {
            if (link.last_synced_at && now - Date.parse(link.last_synced_at) < SYNC_EVERY_MS) continue;
            const result = await syncStore(db, row.project_id, link);
            if (result.last_error) failed++;
            else synced++;
        }
    }
    return { synced, failed };
}
