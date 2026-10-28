import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { xlsxToCsv } from '@/lib/studio/xlsx';
import { importCatalogCsv } from '@/lib/embedded/catalog-format';

describe('Excel exports', () => {
    it('reads the first sheet as CSV that the product import understands', async () => {
        const csv = await xlsxToCsv(new Uint8Array(readFileSync('__tests__/fixtures/bumpa-products.xlsx')).buffer);
        expect(csv).toBe('Product Name,Selling Price,Quantity\n"Ankara Dress, Red",12000,4\nZobo,800,9');
        const imported = importCatalogCsv(csv);
        expect(imported).toMatchObject({ ok: true, products: [{ name: 'Ankara Dress, Red', price: 12000, stock: 4 }, { name: 'Zobo', price: 800, stock: 9 }] });
    });

    it('says so when it is not an Excel file', async () => {
        await expect(xlsxToCsv(new TextEncoder().encode('name,price\nZobo,800').buffer as ArrayBuffer)).rejects.toThrow("That isn't an Excel file.");
    });
});
