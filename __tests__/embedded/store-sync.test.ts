import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/integrations/nango', () => ({ nangoProxy: vi.fn() }));
vi.mock('@/lib/embedded/catalog', () => ({ getCatalog: vi.fn(), saveProducts: vi.fn() }));

import { applyStoreSync, type StoreProduct } from '@/lib/embedded/store-sync';
import type { CatalogProduct } from '@/lib/embedded/catalog-format';

const product = (id: string, name: string, price: number, extra: Partial<CatalogProduct> = {}): CatalogProduct => ({ id, name, price, description: '', options: '', stock: null, available: true, ...extra });
const item = (externalId: string, name: string, price: number, extra: Partial<StoreProduct> = {}): StoreProduct => ({ externalId, name, price, description: '', options: '', stock: null, ...extra });

describe('store sync', () => {
    it('updates linked products, adds new ones and hides what the store dropped', () => {
        const existing = [product('p_dress1', 'Ankara Dress - Red', 12000, { stock: 4 }), product('p_kaftan', 'Adire Kaftan', 18500), product('p_handmd', 'Handmade bag', 7000)];
        const result = applyStoreSync(existing, [
            item('gid://1', 'Ankara dress red', 11000, { stock: 2 }),
            item('gid://3', 'Leather Slides', 9000, { stock: 5 }),
        ], { 'gid://1': 'p_dress1', 'gid://2': 'p_kaftan' });

        expect(result).toMatchObject({ added: 1, updated: 1, hidden: 1 });
        expect(result.products.find((p) => p.id === 'p_dress1')).toMatchObject({ name: 'Ankara Dress - Red', price: 11000, stock: 2 });
        expect(result.products.find((p) => p.id === 'p_kaftan')).toMatchObject({ available: false });
        // Not from the store: left alone.
        expect(result.products.find((p) => p.id === 'p_handmd')).toMatchObject({ available: true, price: 7000 });
        expect(result.links['gid://1']).toBe('p_dress1');
        expect(result.products.find((p) => p.id === result.links['gid://3'])).toMatchObject({ name: 'Leather Slides', stock: 5 });
    });

    it('finds an unlinked product by its name, and changes nothing when nothing changed', () => {
        const existing = [product('p_zobo00', 'Zobo', 800)];
        const first = applyStoreSync(existing, [item('9', 'zobo', 800)], {});
        expect(first).toMatchObject({ added: 0, updated: 0, hidden: 0, links: { 9: 'p_zobo00' } });
    });
});
