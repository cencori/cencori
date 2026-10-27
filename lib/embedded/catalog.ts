/**
 * Agents selling from the business's product catalog: what's for sale, at
 * what price, what's in stock, and the orders customers place in a chat.
 *
 * - The catalog is project-level (shared by its agents): a `tool_connections`
 *   row, with the products and a rolling list of orders in metadata.
 * - An order is priced from the catalog, never from the conversation. With
 *   payments connected it waits for the customer to pay through a link
 *   (see ./payments); stock comes off and the owner hears once it's paid.
 *   Without payments it goes straight to the owner to arrange.
 */

import { randomBytes } from 'crypto';
import type { createAdminClient } from '@/lib/supabaseAdmin';
import { cleanProducts, formatPrice, type CatalogProduct } from './catalog-format';

type Admin = ReturnType<typeof createAdminClient>;

export const CATALOG_SLUG = 'catalog';
const ORDERS_KEPT = 300;
const ITEMS_MAX = 20;
const QUANTITY_MAX = 1_000;

export interface OrderItem {
    product_id: string;
    name: string;
    option: string | null;
    quantity: number;
    price: number;
}

export type OrderStatus = 'awaiting_payment' | 'paid' | 'new' | 'done' | 'cancelled';

export interface CatalogOrder {
    id: string;
    items: OrderItem[];
    total: number;
    currency: string;
    customer: string | null;
    delivery: string | null;
    note: string | null;
    status: OrderStatus;
    payment_reference: string | null;
    agent_id: string;
    conversation_id: string | null;
    created_at: string;
    paid_at: string | null;
    /**
     * How it was paid: by the payment link, by a bank transfer the owner
     * confirmed (lib/embedded/transfers.ts), or marked paid by the owner (cash).
     */
    paid_by?: 'link' | 'transfer' | 'owner';
}

export interface CatalogMetadata {
    kind: 'catalog';
    currency: string;
    products: CatalogProduct[];
    orders: CatalogOrder[];
    updated_at: string;
}

export interface Catalog {
    id: string;
    projectId: string;
    metadata: CatalogMetadata;
}

const COLUMNS = 'id, project_id, metadata';

function toCatalog(row: Record<string, unknown> | null): Catalog | null {
    const metadata = row?.metadata as CatalogMetadata | undefined;
    if (!row || metadata?.kind !== 'catalog') return null;
    return {
        id: row.id as string,
        projectId: row.project_id as string,
        metadata: { ...metadata, products: Array.isArray(metadata.products) ? metadata.products : [], orders: Array.isArray(metadata.orders) ? metadata.orders : [] },
    };
}

export async function getCatalog(db: Admin, projectId: string): Promise<Catalog | null> {
    const { data } = await db.from('tool_connections').select(COLUMNS).eq('project_id', projectId).eq('connector_slug', CATALOG_SLUG).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle();
    return toCatalog(data as Record<string, unknown> | null);
}

/** What the console sees: every product, the latest orders first. */
export function publicCatalog(catalog: Catalog | null) {
    if (!catalog) return null;
    return {
        currency: catalog.metadata.currency,
        products: catalog.metadata.products,
        orders: catalog.metadata.orders.slice(-30).reverse(),
        updated_at: catalog.metadata.updated_at,
    };
}

export const isCurrency = (value: unknown): value is string => typeof value === 'string' && /^[A-Z]{3}$/.test(value);

/** Replace the products (the console sends the whole list), creating the catalog the first time. */
export async function saveProducts(db: Admin, projectId: string, input: { products: unknown; currency?: unknown }): Promise<{ ok: true; catalog: Catalog } | { ok: false; status: number; message: string }> {
    const cleaned = cleanProducts(input.products);
    if (!cleaned.ok) return { ok: false, status: 400, message: cleaned.message };
    if (input.currency !== undefined && !isCurrency(input.currency)) return { ok: false, status: 400, message: 'Currency is a three-letter code, like NGN.' };
    const existing = await getCatalog(db, projectId);
    const currency = (input.currency as string | undefined) ?? existing?.metadata.currency ?? await defaultCurrency(db, projectId);
    if (existing) {
        // Re-read the orders so one placed while the owner was editing isn't lost.
        const updated = await updateCatalog(db, existing.id, (metadata) => ({ ...metadata, currency, products: cleaned.products, updated_at: new Date().toISOString() }));
        return updated ? { ok: true, catalog: updated } : { ok: false, status: 502, message: 'Couldn\'t save the products. Try again.' };
    }
    const metadata: CatalogMetadata = { kind: 'catalog', currency, products: cleaned.products, orders: [], updated_at: new Date().toISOString() };
    const { data, error } = await db.from('tool_connections').insert({ project_id: projectId, connector_slug: CATALOG_SLUG, owner_type: 'platform', status: 'active', metadata }).select(COLUMNS).single();
    const catalog = toCatalog(data as Record<string, unknown> | null);
    if (error || !catalog) return { ok: false, status: 502, message: 'Couldn\'t save the products. Try again.' };
    return { ok: true, catalog };
}

/** The payment provider's currency when one is connected, so prices and links agree; naira otherwise. */
async function defaultCurrency(db: Admin, projectId: string): Promise<string> {
    const { getPaymentsConnection } = await import('./payments');
    return (await getPaymentsConnection(db, projectId))?.metadata.currency ?? 'NGN';
}

/** Change the catalog, re-reading it first so concurrent writes (orders, edits) aren't lost. */
async function updateCatalog(db: Admin, catalogId: string, change: (metadata: CatalogMetadata) => CatalogMetadata): Promise<Catalog | null> {
    const { data } = await db.from('tool_connections').select(COLUMNS).eq('id', catalogId).maybeSingle();
    const current = toCatalog(data as Record<string, unknown> | null);
    if (!current) return null;
    const next = change(current.metadata);
    const metadata = { ...next, orders: next.orders.slice(-ORDERS_KEPT) };
    const { error } = await db.from('tool_connections').update({ metadata }).eq('id', catalogId);
    return error ? null : { ...current, metadata };
}

/** The owner was paid another way (cash, transfer): the order counts as paid from now. */
export async function markOrderPaidByOwner(db: Admin, projectId: string, orderId: string): Promise<Catalog | null> {
    const catalog = await getCatalog(db, projectId);
    const order = catalog?.metadata.orders.find((o) => o.id === orderId);
    if (!catalog || !order || order.status === 'cancelled') return null;
    if (order.status === 'paid' || order.paid_at) return catalog;
    const paidAt = new Date().toISOString();
    return updateCatalog(db, catalog.id, (metadata) => {
        const current = metadata.orders.find((o) => o.id === orderId);
        if (!current || current.status === 'paid' || current.status === 'cancelled') return metadata;
        return {
            ...metadata,
            // Stock for an order waiting on its payment link comes off when it's paid, however it's paid.
            products: current.status === 'awaiting_payment' ? takeStock(metadata.products, current.items) : metadata.products,
            orders: metadata.orders.map((o) => (o.id === orderId ? { ...o, status: 'paid', paid_at: paidAt, paid_by: 'owner' } : o)),
        };
    });
}

/** Owner's changes to an order from the console: done or cancelled. */
export async function setOrderStatus(db: Admin, projectId: string, orderId: string, status: 'done' | 'cancelled'): Promise<Catalog | null> {
    const catalog = await getCatalog(db, projectId);
    if (!catalog || !catalog.metadata.orders.some((o) => o.id === orderId)) return null;
    return updateCatalog(db, catalog.id, (metadata) => ({ ...metadata, orders: metadata.orders.map((o) => (o.id === orderId ? { ...o, status } : o)) }));
}

/** Take the order's items out of stock (products that track it). */
function takeStock(products: CatalogProduct[], items: OrderItem[]): CatalogProduct[] {
    return products.map((product) => {
        if (product.stock === null) return product;
        const sold = items.filter((item) => item.product_id === product.id).reduce((sum, item) => sum + item.quantity, 0);
        return sold ? { ...product, stock: Math.max(0, product.stock - sold) } : product;
    });
}

export const orderSummary = (order: Pick<CatalogOrder, 'items' | 'currency'>) => order.items
    .map((item) => `${item.quantity} × ${item.name}${item.option ? ` (${item.option})` : ''}`)
    .join(', ');

interface OrderContext {
    db: Admin;
    projectId: string;
    agentId: string;
    agentName?: string;
    surface: string;
    conversationId?: string | null;
}

export interface OrderRequest {
    items: Array<{ product_id?: unknown; quantity?: unknown; option?: unknown }>;
    customer_name: string | null;
    delivery: string | null;
    note: string | null;
    email: string | null;
}

/**
 * Place an order from the catalog. Prices and stock come from the catalog;
 * the outcome is what the agent tells the customer.
 */
export async function placeOrder(ctx: OrderContext, request: OrderRequest): Promise<{ ok: true; order: CatalogOrder; link: string | null; transfer: { reference: string; instructions: string } | null } | { ok: false; message: string }> {
    const catalog = await getCatalog(ctx.db, ctx.projectId);
    if (!catalog || catalog.metadata.products.length === 0) return { ok: false, message: 'This business hasn\'t added its products yet.' };
    if (!Array.isArray(request.items) || request.items.length === 0) return { ok: false, message: 'Add at least one item (product_id and quantity, from find_products).' };
    if (request.items.length > ITEMS_MAX) return { ok: false, message: `An order holds up to ${ITEMS_MAX} different items.` };
    const { currency, products } = catalog.metadata;
    const items: OrderItem[] = [];
    for (const raw of request.items) {
        const product = products.find((p) => p.id === raw.product_id && p.available);
        if (!product) return { ok: false, message: `There's no product with id ${String(raw.product_id)}. Look it up with find_products first.` };
        const quantity = Math.floor(Number(raw.quantity ?? 1));
        if (!(quantity >= 1 && quantity <= QUANTITY_MAX)) return { ok: false, message: `Give a quantity for ${product.name}.` };
        const option = typeof raw.option === 'string' && raw.option.trim() ? raw.option.trim().slice(0, 80) : null;
        if (product.options && !option) return { ok: false, message: `Ask which option they want for ${product.name} (${product.options}).` };
        items.push({ product_id: product.id, name: product.name, option, quantity, price: product.price });
    }
    for (const product of products) {
        const wanted = items.filter((item) => item.product_id === product.id).reduce((sum, item) => sum + item.quantity, 0);
        if (wanted && product.stock !== null && wanted > product.stock) {
            return { ok: false, message: product.stock === 0 ? `${product.name} is out of stock.` : `Only ${product.stock} of ${product.name} left.` };
        }
    }
    const total = Math.round(items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;
    const { customerOf, getPaymentsConnection, requestPayment } = await import('./payments');
    const customer = await customerOf(ctx.db, ctx.conversationId);
    const order: CatalogOrder = {
        id: `ORD-${randomBytes(4).toString('hex').toUpperCase()}`,
        items,
        total,
        currency,
        customer: [request.customer_name, customer.label].filter(Boolean).join(' · ') || null,
        delivery: request.delivery,
        note: request.note,
        status: 'new',
        payment_reference: null,
        agent_id: ctx.agentId,
        conversation_id: ctx.conversationId ?? null,
        created_at: new Date().toISOString(),
        paid_at: null,
    };

    // Paid through a link when the business takes payments in the catalog's currency.
    const payments = await getPaymentsConnection(ctx.db, ctx.projectId);
    let link: string | null = null;
    let transfer: { reference: string; instructions: string } | null = null;
    if (payments && payments.metadata.currency === currency && total > 0) {
        const started = await requestPayment(ctx, { amount: total, description: `Order ${order.id}: ${orderSummary(order)}`.slice(0, 200), email: request.email });
        if (!started.ok) return { ok: false, message: started.message };
        order.status = 'awaiting_payment';
        order.payment_reference = started.reference;
        link = started.link;
    } else if (total > 0 && currency === 'NGN') {
        // No payment links, but the business takes transfers: the customer sends it, the owner confirms.
        const { getTransfers, startTransfer } = await import('./transfers');
        if (await getTransfers(ctx.db, ctx.projectId)) {
            const started = await startTransfer(ctx, { amount: total, description: `Order ${order.id}: ${orderSummary(order)}`.slice(0, 200), orderId: order.id, customer: order.customer });
            if (started.ok) {
                order.status = 'awaiting_payment';
                order.payment_reference = started.reference;
                transfer = { reference: started.reference, instructions: started.instructions };
            }
        }
    }
    const saved = await updateCatalog(ctx.db, catalog.id, (metadata) => ({
        ...metadata,
        // Unpaid orders go to the owner as they are, so their stock is held now.
        products: order.status === 'new' ? takeStock(metadata.products, items) : metadata.products,
        orders: [...metadata.orders, order],
    }));
    if (!saved) return { ok: false, message: 'Couldn\'t save the order right now.' };
    if (order.status === 'new') {
        const { notifyOrder } = await import('./owner-alerts');
        await notifyOrder(ctx, describeOrder(order), false);
    }
    return { ok: true, order, link, transfer };
}

/** The order as the owner reads it. */
export function describeOrder(order: CatalogOrder) {
    return {
        id: order.id,
        summary: orderSummary(order),
        total: formatPrice(order.total, order.currency),
        customer: order.customer,
        delivery: order.delivery,
        note: order.note,
    };
}

/**
 * When a payment is for an order: mark it paid and take its stock. Returns
 * the order (to tell the owner about it) or null when the payment wasn't one.
 */
export async function markOrderPaid(db: Admin, projectId: string, paymentReference: string, paidAt: string): Promise<CatalogOrder | null> {
    const catalog = await getCatalog(db, projectId);
    const order = catalog?.metadata.orders.find((o) => o.payment_reference === paymentReference);
    if (!catalog || !order) return null;
    if (order.status !== 'awaiting_payment') return order;
    await updateCatalog(db, catalog.id, (metadata) => {
        const current = metadata.orders.find((o) => o.id === order.id);
        if (!current || current.status !== 'awaiting_payment') return metadata;
        return {
            ...metadata,
            products: takeStock(metadata.products, current.items),
            orders: metadata.orders.map((o) => (o.id === order.id ? { ...o, status: 'paid', paid_at: paidAt, paid_by: 'link' } : o)),
        };
    });
    return { ...order, status: 'paid', paid_at: paidAt };
}

/** A transfer for the order arrived (the owner confirmed it): mark it paid and take its stock. */
export async function markOrderPaidByTransfer(db: Admin, projectId: string, orderId: string, paidAt: string): Promise<void> {
    const catalog = await getCatalog(db, projectId);
    if (!catalog) return;
    await updateCatalog(db, catalog.id, (metadata) => {
        const current = metadata.orders.find((o) => o.id === orderId);
        if (!current || current.status === 'paid' || current.status === 'cancelled' || current.paid_at) return metadata;
        return {
            ...metadata,
            products: current.status === 'awaiting_payment' ? takeStock(metadata.products, current.items) : metadata.products,
            orders: metadata.orders.map((o) => (o.id === orderId ? { ...o, status: 'paid', paid_at: paidAt, paid_by: 'transfer' } : o)),
        };
    });
}

/** The latest order placed in a conversation, for "where's my order?". */
export async function latestOrderIn(db: Admin, projectId: string, conversationId: string | null | undefined): Promise<CatalogOrder | null> {
    if (!conversationId) return null;
    const catalog = await getCatalog(db, projectId);
    return catalog?.metadata.orders.filter((o) => o.conversation_id === conversationId).at(-1) ?? null;
}
