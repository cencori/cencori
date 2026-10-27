import { beforeEach, describe, expect, it, vi } from 'vitest';

const payments = vi.hoisted(() => ({
    customerOf: vi.fn(),
    getPaymentsConnection: vi.fn(),
    requestPayment: vi.fn(),
}));
const alerts = vi.hoisted(() => ({ notifyOrder: vi.fn() }));
vi.mock('@/lib/embedded/payments', () => payments);
vi.mock('@/lib/embedded/owner-alerts', () => alerts);

import { cleanProducts, describeProduct, importCatalogCsv, parsePrice, searchProducts, type CatalogProduct } from '@/lib/embedded/catalog-format';
import { markOrderPaid, markOrderPaidByOwner, placeOrder, type CatalogMetadata } from '@/lib/embedded/catalog';
import { agentToolset } from '@/lib/embedded/agent-tools';

/** tool_connections in memory: just the queries the catalog makes. */
function fakeDb(rows: Array<Record<string, unknown>>) {
    return {
        from: () => {
            const filters: Array<[string, unknown]> = [];
            let patch: Record<string, unknown> | null = null;
            const match = () => rows.filter((row) => filters.every(([key, value]) => row[key] === value));
            const builder = {
                select: () => builder,
                eq: (key: string, value: unknown) => { filters.push([key, value]); return builder; },
                order: () => builder,
                limit: () => builder,
                maybeSingle: async () => ({ data: match()[0] ?? null, error: null }),
                update: (values: Record<string, unknown>) => { patch = values; return builder; },
                then: (resolve: (value: unknown) => void) => {
                    if (patch) for (const row of match()) Object.assign(row, patch);
                    resolve({ error: null });
                },
            };
            return builder;
        },
    };
}

const product = (overrides: Partial<CatalogProduct>): CatalogProduct => ({ id: 'p_aaaaaa', name: 'Ankara wrap dress', price: 25000, description: '', options: '', stock: null, available: true, ...overrides });

function catalogRow(products: CatalogProduct[]) {
    const metadata: CatalogMetadata = { kind: 'catalog', currency: 'NGN', products, orders: [], updated_at: '2026-10-26T00:00:00Z' };
    return { id: 'c1', project_id: 'p1', connector_slug: 'catalog', status: 'active', metadata };
}

const ctx = (db: unknown) => ({ db: db as never, projectId: 'p1', agentId: 'a1', surface: 'conversation', conversationId: 's1' });
const order = (items: unknown[]) => ({ items: items as never, customer_name: 'Ada', delivery: '12 Allen Ave, Ikeja', note: null, email: null });

describe('catalog format', () => {
    it('reads prices the way people write them', () => {
        expect(parsePrice('₦12,500')).toBe(12500);
        expect(parsePrice('N 4,000.50')).toBe(4000.5);
        expect(parsePrice(3000)).toBe(3000);
        expect(parsePrice('free')).toBeNull();
        expect(parsePrice('1.2.3')).toBeNull();
    });

    it('imports a store export by its column names, folding variant rows into options', () => {
        const csv = [
            'Handle,Title,Option1 Value,Variant Price,Variant Inventory Qty,Body (HTML)',
            'dress,Ankara wrap dress,S,"₦25,000",2,"<p>Cotton, <b>hand-made</b></p>"',
            'dress,Ankara wrap dress,M,"₦25,000",3,',
            'bag,Raffia bag,,15000,,Woven',
            ',,,,,',
            'x,No price,,,,',
        ].join('\n');
        const result = importCatalogCsv(csv);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.skipped).toBe(1);
        expect(result.products).toHaveLength(2);
        expect(result.products[0]).toMatchObject({ name: 'Ankara wrap dress', price: 25000, options: 'S, M', stock: 5, description: 'Cotton, hand-made' });
        expect(result.products[1]).toMatchObject({ name: 'Raffia bag', price: 15000, stock: null });
    });

    it('imports a sheet pasted with tabs, and says what a sheet is missing', () => {
        const pasted = importCatalogCsv('Product\tSelling price\tQty\nJollof tray\t18000\t4');
        expect(pasted.ok && pasted.products[0]).toMatchObject({ name: 'Jollof tray', price: 18000, stock: 4 });
        const missing = importCatalogCsv('Item,Colour\nDress,Red');
        expect(missing.ok).toBe(false);
    });

    it('checks what the console saves', () => {
        expect(cleanProducts([{ name: '', price: 1 }]).ok).toBe(false);
        expect(cleanProducts([{ name: 'Bag' }]).ok).toBe(false);
        const ok = cleanProducts([{ id: 'p_abcdef', name: '  Bag ', price: '5,000', stock: '' }]);
        expect(ok.ok && ok.products[0]).toMatchObject({ id: 'p_abcdef', name: 'Bag', price: 5000, stock: null, available: true });
    });

    it('finds products from the customer\'s own words', () => {
        const products = [product({ id: 'p_1', name: 'Ankara wrap dress', options: 'S, M' }), product({ id: 'p_2', name: 'Raffia bag', description: 'Woven, cream' }), product({ id: 'p_3', name: 'Ankara bag', available: false })];
        expect(searchProducts(products, 'ankara dress').map((p) => p.id)).toEqual(['p_1']);
        expect(searchProducts(products, 'cream').map((p) => p.id)).toEqual(['p_2']);
        expect(searchProducts(products, '').map((p) => p.id)).toEqual(['p_1', 'p_2']);
        expect(searchProducts(products, 'shoes')).toEqual([]);
        expect(describeProduct(product({ stock: 0, options: 'S, M' }), 'NGN')).toBe('Ankara wrap dress (id p_aaaaaa): ₦25,000 · options: S, M · out of stock');
    });
});

describe('orders', () => {
    beforeEach(() => {
        Object.values(payments).forEach((fn) => fn.mockReset());
        alerts.notifyOrder.mockReset();
        payments.customerOf.mockResolvedValue({ label: '+2348012345678', number: '+2348012345678' });
    });

    it('prices from the catalog and sends a payment link when payments are connected', async () => {
        const row = catalogRow([product({ id: 'p_dress', options: 'S, M', stock: 3 })]);
        const db = fakeDb([row]);
        payments.getPaymentsConnection.mockResolvedValue({ metadata: { currency: 'NGN' } });
        payments.requestPayment.mockResolvedValue({ ok: true, link: 'https://pay.example/x', reference: 'cen_aaaaaaaaaaaaaaaaaa', amount: '₦50,000' });
        const result = await placeOrder(ctx(db), order([{ product_id: 'p_dress', quantity: 2, option: 'M' }]));
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.link).toBe('https://pay.example/x');
        expect(result.order).toMatchObject({ total: 50000, status: 'awaiting_payment', payment_reference: 'cen_aaaaaaaaaaaaaaaaaa', customer: 'Ada · +2348012345678' });
        expect(payments.requestPayment.mock.calls[0][1]).toMatchObject({ amount: 50000 });
        // Stock waits for the payment; the owner hears once it's paid.
        expect(row.metadata.products[0].stock).toBe(3);
        expect(alerts.notifyOrder).not.toHaveBeenCalled();

        const paid = await markOrderPaid(db as never, 'p1', 'cen_aaaaaaaaaaaaaaaaaa', '2026-10-26T10:00:00Z');
        expect(paid?.status).toBe('paid');
        expect(row.metadata.products[0].stock).toBe(1);
        expect(row.metadata.orders[0].status).toBe('paid');
        // Paying twice doesn't take the stock twice.
        await markOrderPaid(db as never, 'p1', 'cen_aaaaaaaaaaaaaaaaaa', '2026-10-26T10:00:00Z');
        expect(row.metadata.products[0].stock).toBe(1);
    });

    it('sends the order straight to the owner without payments, holding its stock', async () => {
        const row = catalogRow([product({ id: 'p_dress', stock: 3 })]);
        payments.getPaymentsConnection.mockResolvedValue(null);
        const result = await placeOrder(ctx(fakeDb([row])), order([{ product_id: 'p_dress', quantity: 1 }]));
        expect(result.ok && result.link).toBeNull();
        expect(row.metadata.orders[0].status).toBe('new');
        expect(row.metadata.products[0].stock).toBe(2);
        expect(alerts.notifyOrder).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ total: '₦25,000', summary: '1 × Ankara wrap dress' }), false);
    });

    it('lets the owner mark an order paid another way, taking held-back stock once', async () => {
        const row = catalogRow([product({ id: 'p_dress', stock: 3 })]);
        const db = fakeDb([row]);
        payments.getPaymentsConnection.mockResolvedValue({ metadata: { currency: 'NGN' } });
        payments.requestPayment.mockResolvedValue({ ok: true, link: 'https://pay.example/y', reference: 'cen_bbbbbbbbbbbbbbbbbb', amount: '₦25,000' });
        const placed = await placeOrder(ctx(db), order([{ product_id: 'p_dress', quantity: 1 }]));
        if (!placed.ok) throw new Error('order not placed');
        // Paid in cash instead of by the link.
        await markOrderPaidByOwner(db as never, 'p1', placed.order.id);
        expect(row.metadata.orders[0]).toMatchObject({ status: 'paid', paid_by: 'owner' });
        expect(row.metadata.products[0].stock).toBe(2);
        // The link paid later too: no second deduction.
        await markOrderPaid(db as never, 'p1', 'cen_bbbbbbbbbbbbbbbbbb', '2026-10-26T10:00:00Z');
        await markOrderPaidByOwner(db as never, 'p1', placed.order.id);
        expect(row.metadata.products[0].stock).toBe(2);
    });

    it('refuses what the catalog can\'t fill', async () => {
        payments.getPaymentsConnection.mockResolvedValue(null);
        const db = fakeDb([catalogRow([product({ id: 'p_dress', options: 'S, M', stock: 1 }), product({ id: 'p_off', available: false })])]);
        const message = async (items: unknown[]) => { const r = await placeOrder(ctx(db), order(items)); return r.ok ? 'ok' : r.message; };
        expect(await message([{ product_id: 'p_dress', quantity: 2, option: 'S' }])).toMatch(/Only 1/);
        expect(await message([{ product_id: 'p_dress', quantity: 1 }])).toMatch(/which option/);
        expect(await message([{ product_id: 'p_off', quantity: 1 }])).toMatch(/no product/);
        expect(await message([{ product_id: 'p_made_up', quantity: 1 }])).toMatch(/find_products/);
        expect(await message([])).toMatch(/at least one/);
    });

    it('offers the selling tools, with check_payment, only when Sell products is on', () => {
        expect(agentToolset({}).has('find_products')).toBe(false);
        const selling = agentToolset({ system_tools: { sell_products: {} } });
        expect(selling.has('find_products') && selling.has('place_order') && selling.has('check_payment')).toBe(true);
        expect(selling.has('request_payment')).toBe(false);
        const both = agentToolset({ system_tools: { sell_products: {}, take_payments: {} } });
        expect(both.definitions.filter((d) => d.function.name === 'check_payment')).toHaveLength(1);
    });
});
