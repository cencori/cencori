/**
 * A business's product catalog as the console and the agent both read it:
 * the product shape, checking what the owner saves, importing a spreadsheet
 * (CSV from Bumpa, Selar, Shopify or a hand-made sheet) and finding products
 * by what a customer asks for. Nothing here touches the server.
 */

export const PRODUCTS_MAX = 500;
const NAME_MAX = 120;
const TEXT_MAX = 500;
const OPTIONS_MAX = 200;
export const MAX_PRICE = 100_000_000;

export interface CatalogProduct {
    id: string;
    name: string;
    /** In the catalog's currency's main unit (naira, dollars). */
    price: number;
    description: string;
    /** Sizes, colours, flavours…: free text, e.g. "S, M, L". */
    options: string;
    /** Units left, or null when the business doesn't track stock. */
    stock: number | null;
    /** Off hides it from customers without deleting it. */
    available: boolean;
}

/** A short id for a new product. */
export function newProductId(): string {
    const bytes = new Uint8Array(6);
    globalThis.crypto.getRandomValues(bytes);
    return `p_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** "₦12,500", "N12500", "12,500.00" → 12500. */
export function parsePrice(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) && value >= 0 && value <= MAX_PRICE ? Math.round(value * 100) / 100 : null;
    if (typeof value !== 'string') return null;
    const cleaned = value.replace(/[^\d.]/g, '');
    if (!cleaned || cleaned.split('.').length > 2) return null;
    return parsePrice(Number(cleaned));
}

function parseStock(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = typeof value === 'number' ? value : Number(String(value).replace(/[^\d-]/g, ''));
    return Number.isFinite(n) ? Math.max(0, Math.min(1_000_000, Math.floor(n))) : null;
}

/** Check the products the console sends; ids are kept so orders still point at them. */
export function cleanProducts(input: unknown): { ok: true; products: CatalogProduct[] } | { ok: false; message: string } {
    if (!Array.isArray(input)) return { ok: false, message: 'Send products as a list.' };
    if (input.length > PRODUCTS_MAX) return { ok: false, message: `A catalog holds up to ${PRODUCTS_MAX} products.` };
    const seen = new Set<string>();
    const products: CatalogProduct[] = [];
    for (const [index, raw] of input.entries()) {
        const item = (raw ?? {}) as Record<string, unknown>;
        const name = text(item.name, NAME_MAX);
        if (!name) return { ok: false, message: `Product ${index + 1} needs a name.` };
        const price = parsePrice(item.price);
        if (price === null) return { ok: false, message: `${name} needs a price.` };
        let id = typeof item.id === 'string' && /^p_[a-z0-9]{6,24}$/.test(item.id) ? item.id : newProductId();
        if (seen.has(id)) id = newProductId();
        seen.add(id);
        products.push({
            id,
            name,
            price,
            description: text(item.description, TEXT_MAX),
            options: text(item.options, OPTIONS_MAX),
            stock: parseStock(item.stock),
            available: item.available !== false,
        });
    }
    return { ok: true, products };
}

/** Split CSV text into rows, with quoted fields ("a, b", ""quotes""). */
export function parseCsv(input: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let quoted = false;
    const source = input.replace(/^﻿/, '');
    // Tab-separated when the header row has tabs and no commas (pasted from a spreadsheet).
    const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
    const separator = firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ',';
    for (let i = 0; i < source.length; i++) {
        const c = source[i];
        if (quoted) {
            if (c === '"' && source[i + 1] === '"') { field += '"'; i++; }
            else if (c === '"') quoted = false;
            else field += c;
        } else if (c === '"' && field === '') quoted = true;
        else if (c === separator) { row.push(field); field = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && source[i + 1] === '\n') i++;
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else field += c;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((cell) => cell.trim()));
}

/** Header names stores export, by the field they fill. The first match wins. */
const HEADERS: Record<'name' | 'price' | 'stock' | 'description' | 'options', RegExp> = {
    name: /^(product[ _]?name|name|title|product|item|item[ _]?name)$/,
    price: /^(selling[ _]?price|sale[ _]?price|price|unit[ _]?price|amount|cost|variant[ _]?price)( ?\(.*\))?$/,
    stock: /^(stock|quantity|qty|inventory|in[ _]?stock|stock[ _]?quantity|available[ _]?quantity|variant[ _]?inventory[ _]?qty)$/,
    description: /^(description|details|product[ _]?description|body|body[ _]?\(html\)|summary)$/,
    options: /^(options|variants|variant|sizes|size|colou?rs?|option1[ _]?value)$/,
};

/**
 * Products from a spreadsheet: a header row, then one product per row.
 * Columns are found by their names (Name/Title, Price/Selling price,
 * Stock/Quantity, Description, Options/Sizes); other columns are ignored.
 * Rows repeating a product's name (Shopify's variant rows) add to its options.
 */
export function importCatalogCsv(input: string): { ok: true; products: CatalogProduct[]; skipped: number } | { ok: false; message: string } {
    const rows = parseCsv(input);
    if (rows.length < 2) return { ok: false, message: 'Add a header row (Name, Price…) and at least one product.' };
    const header = rows[0].map((cell) => cell.trim().toLowerCase());
    const column = (field: keyof typeof HEADERS) => header.findIndex((cell) => HEADERS[field].test(cell));
    const at = { name: column('name'), price: column('price'), stock: column('stock'), description: column('description'), options: column('options') };
    if (at.name < 0 || at.price < 0) return { ok: false, message: 'The first row needs a Name (or Title) column and a Price column.' };
    const byName = new Map<string, CatalogProduct>();
    let skipped = 0;
    for (const row of rows.slice(1)) {
        const name = text(row[at.name], NAME_MAX);
        const price = parsePrice(row[at.price]);
        const option = at.options >= 0 ? text(row[at.options], OPTIONS_MAX) : '';
        const existing = byName.get(name.toLowerCase());
        if (existing) {
            if (option && !existing.options.split(', ').includes(option)) existing.options = text(existing.options ? `${existing.options}, ${option}` : option, OPTIONS_MAX);
            const stock = at.stock >= 0 ? parseStock(row[at.stock]) : null;
            if (stock !== null) existing.stock = (existing.stock ?? 0) + stock;
            continue;
        }
        if (!name || price === null) { skipped++; continue; }
        if (byName.size >= PRODUCTS_MAX) { skipped++; continue; }
        byName.set(name.toLowerCase(), {
            id: newProductId(),
            name,
            price,
            description: at.description >= 0 ? text(row[at.description]?.replace(/<[^>]+>/g, ' '), TEXT_MAX) : '',
            options: option,
            stock: at.stock >= 0 ? parseStock(row[at.stock]) : null,
            available: true,
        });
    }
    if (byName.size === 0) return { ok: false, message: 'No rows had both a name and a price.' };
    return { ok: true, products: [...byName.values()], skipped };
}

const words = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 1);

/**
 * Products matching what the customer asked for, best first: every word of
 * the query counts, whole-word matches in the name most. An empty query
 * lists the catalog from the top.
 */
export function searchProducts(products: CatalogProduct[], query: string, limit = 10): CatalogProduct[] {
    const visible = products.filter((p) => p.available);
    const terms = words(query);
    if (terms.length === 0) return visible.slice(0, limit);
    const scored = visible.map((product) => {
        const name = words(product.name);
        const rest = words(`${product.description} ${product.options}`);
        let score = 0;
        for (const term of terms) {
            if (name.includes(term)) score += 3;
            else if (name.some((w) => w.startsWith(term) || term.startsWith(w))) score += 2;
            else if (rest.some((w) => w === term || w.startsWith(term))) score += 1;
        }
        return { product, score };
    });
    return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.product);
}

/** "₦20,000", "$25.50" */
export function formatPrice(amount: number, currency: string): string {
    try {
        return new Intl.NumberFormat('en-NG', { style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 }).format(amount);
    } catch {
        return `${currency} ${amount.toLocaleString('en-NG')}`;
    }
}

/** A product as the agent reads it in one line. */
export function describeProduct(product: CatalogProduct, currency: string): string {
    return [
        `${product.name} (id ${product.id}): ${formatPrice(product.price, currency)}`,
        product.options && `options: ${product.options}`,
        product.stock === null ? null : product.stock > 0 ? `${product.stock} in stock` : 'out of stock',
        product.description && product.description.slice(0, 200),
    ].filter(Boolean).join(' · ');
}
