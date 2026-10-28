import { describe, expect, it } from 'vitest';
import { applyMerge, mergeProducts, nameSimilarity, productKey, type IncomingProduct } from '@/lib/embedded/catalog-merge';
import type { CatalogProduct } from '@/lib/embedded/catalog-format';

const product = (name: string, price: number, extra: Partial<CatalogProduct> = {}): CatalogProduct => ({ id: `p_${name.replace(/\W/g, '').toLowerCase().slice(0, 10).padEnd(6, 'x')}`, name, price, description: '', options: '', stock: null, available: true, ...extra });
const from = (source: string, name: string, price: number, extra: Partial<IncomingProduct> = {}): IncomingProduct => ({ name, price, source, ...extra });

describe('putting products from several places into one list', () => {
    it('matches the same product under different names', () => {
        expect(productKey('Ankara Dress - Red')).toBe(productKey('Red ankara dress'));
        expect(productKey('Sneakers (Black)')).toBe(productKey('black sneaker'));
        expect(productKey('Beef suya')).not.toBe(productKey('Chicken suya'));
        expect(nameSimilarity('Beef suya', 'Beef suya large')).toBeGreaterThan(0.6);
    });

    it('joins sources, asks when prices differ, and updates what changed', () => {
        const existing = [product('Beef suya', 3000), product('Zobo', 800, { stock: 10 })];
        const rows = mergeProducts(existing, [
            from('Shopify', 'Ankara Dress - Red', 12000, { options: 'S, M', stock: 4 }),
            from('Bumpa', 'Red ankara dress', 11500, { options: 'L' }),
            from('Screenshots', 'Zobo', 800, { stock: 25 }),
            from('Screenshots', 'Beef suya', 3000),
            from('Bumpa', 'Kilishi', 5000),
        ]);
        const byKind = (kind: string) => rows.filter((row) => row.kind === kind);
        expect(rows[0].kind).toBe('prices');
        expect(byKind('prices')[0]).toMatchObject({ prices: [{ price: 12000, sources: ['Shopify'] }, { price: 11500, sources: ['Bumpa'] }], sources: ['Shopify', 'Bumpa'] });
        expect(byKind('prices')[0].product.options).toBe('S, M, L');
        expect(byKind('new').map((row) => row.product.name)).toEqual(['Kilishi']);
        const updates = byKind('update') as Array<Extract<(typeof rows)[number], { kind: 'update' }>>;
        expect(updates.find((row) => row.product.name === 'Zobo')!.changes).toEqual(['stock 10 → 25']);
        expect(updates.find((row) => row.product.name === 'Beef suya')!.changes).toEqual([]);

        const merged = applyMerge(existing, rows, { [rows[0].key]: { price: 11500 } });
        expect(merged).toMatchObject({ added: 2, updated: 1, dropped: 0 });
        expect(merged.products.find((p) => /ankara/i.test(p.name))!.price).toBe(11500);
        expect(merged.products.find((p) => p.name === 'Zobo')).toMatchObject({ id: existing[1].id, stock: 25 });
        expect(merged.products).toHaveLength(4);
    });

    it('asks before merging a near match, and keeps both when told they differ', () => {
        const existing = [product('Beef suya', 3000)];
        const rows = mergeProducts(existing, [from('WhatsApp', 'Beef suya large', 4500)]);
        expect(rows).toEqual([expect.objectContaining({ kind: 'maybe', existing: existing[0] })]);
        expect(applyMerge(existing, rows, { [rows[0].key]: { same: true } }).products).toEqual([expect.objectContaining({ id: existing[0].id, price: 4500 })]);
        expect(applyMerge(existing, rows, {}).products).toHaveLength(2);
    });
});
