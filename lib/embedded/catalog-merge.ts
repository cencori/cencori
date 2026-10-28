/**
 * Putting products from several places into one list: store exports
 * (Shopify, Bumpa), screenshots of a WhatsApp catalog, a pasted price list,
 * and what the catalog already has. The same product goes by different names
 * in different places ("Ankara Dress - Red", "Red ankara dress"), so names are
 * compared by their words, not letter by letter.
 *
 * Nothing is decided silently when it's unclear: a product with two different
 * prices, or one that's nearly but not quite the same as another, comes back
 * as a choice for the owner. Runs in the browser; nothing here touches the server.
 */

import { PRODUCTS_MAX, newProductId, type CatalogProduct } from '@/lib/embedded/catalog-format';

export interface IncomingProduct {
    name: string;
    price: number;
    description?: string;
    options?: string;
    stock?: number | null;
    /** Where it came from, as the owner would say it: "Shopify export", "Screenshots". */
    source: string;
    /** The product's id in a connected store, so later syncs find the same product. */
    externalId?: string;
}

export type MergeRow =
    /** Not in the catalog yet. */
    | { kind: 'new'; key: string; product: CatalogProduct; sources: string[]; externalIds: string[] }
    /** In the catalog; what changes (price, stock…), possibly nothing. */
    | { kind: 'update'; key: string; product: CatalogProduct; existing: CatalogProduct; changes: string[]; sources: string[]; externalIds: string[] }
    /** The same product with different prices in different places: the owner picks one. */
    | { kind: 'prices'; key: string; product: CatalogProduct; existing: CatalogProduct | null; prices: Array<{ price: number; sources: string[] }>; sources: string[]; externalIds: string[] }
    /** Close to a product already in the catalog: the same one, or a new one? */
    | { kind: 'maybe'; key: string; product: CatalogProduct; existing: CatalogProduct; sources: string[]; externalIds: string[] };

const STOP = new Set(['the', 'and', 'with', 'for', 'of', 'a', 'an', '&', '-', 'x']);

function words(name: string): string[] {
    return name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)
        // "pcs"/"pc" and plurals vary between stores; "shoes" and "shoe" are the same product.
        .map((word) => word.replace(/(?<=\w{3})s$/, ''))
        .filter((word) => word && !STOP.has(word));
}

/** Two names for the same product have the same key: the same words, in any order. */
export function productKey(name: string): string {
    return [...new Set(words(name))].sort().join(' ');
}

/** How alike two names are, 0 to 1, by the words they share. */
export function nameSimilarity(a: string, b: string): number {
    const left = new Set(words(a));
    const right = new Set(words(b));
    if (!left.size || !right.size) return 0;
    let shared = 0;
    for (const word of left) if (right.has(word)) shared++;
    return shared / (left.size + right.size - shared);
}

/** Close enough to ask; not the same words, so not merged without asking. */
const MAYBE_SAME = 0.6;

function joinOptions(...lists: Array<string | undefined>): string {
    const all = lists.flatMap((list) => (list ?? '').split(',').map((item) => item.trim()).filter(Boolean));
    const seen = new Set<string>();
    return all.filter((item) => (seen.has(item.toLowerCase()) ? false : (seen.add(item.toLowerCase()), true))).join(', ').slice(0, 200);
}

function money(amount: number): string {
    return `₦${amount.toLocaleString('en-NG')}`;
}

/**
 * Every incoming product against each other and against the catalog. Rows
 * come back in the order the owner reviews them: choices first, then new,
 * then updates.
 */
export function mergeProducts(existing: CatalogProduct[], incoming: IncomingProduct[]): MergeRow[] {
    // Incoming copies of the same product (by words) become one, from every source.
    const groups = new Map<string, IncomingProduct[]>();
    for (const item of incoming) {
        const key = productKey(item.name);
        if (!key || !(item.price >= 0)) continue;
        groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    const byKey = new Map(existing.map((product) => [productKey(product.name), product]));

    const rows: MergeRow[] = [];
    for (const [key, items] of groups) {
        const sources = [...new Set(items.map((item) => item.source))];
        const externalIds = items.map((item) => item.externalId).filter((id): id is string => !!id);
        const first = items[0];
        // The fullest description, every option, stock from where it's tracked.
        const description = items.map((item) => item.description ?? '').sort((a, b) => b.length - a.length)[0] ?? '';
        const options = joinOptions(...items.map((item) => item.options));
        const stocks = items.map((item) => item.stock).filter((stock): stock is number => typeof stock === 'number');
        const stock = stocks.length ? Math.max(...stocks) : null;
        const prices = new Map<number, string[]>();
        for (const item of items) prices.set(item.price, [...new Set([...(prices.get(item.price) ?? []), item.source])]);

        const match = byKey.get(key) ?? null;
        const product: CatalogProduct = {
            id: match?.id ?? newProductId(),
            name: match?.name ?? first.name.trim().slice(0, 120),
            price: first.price,
            description: (description || match?.description || '').slice(0, 500),
            options: joinOptions(match?.options, options),
            stock: stock ?? match?.stock ?? null,
            available: match?.available ?? true,
        };

        if (prices.size > 1) {
            rows.push({ kind: 'prices', key, product, existing: match, prices: [...prices].map(([price, from]) => ({ price, sources: from })), sources, externalIds });
            continue;
        }
        if (match) {
            const changes = [
                match.price !== product.price && `price ${money(match.price)} → ${money(product.price)}`,
                (match.stock ?? null) !== product.stock && product.stock !== null && `stock ${match.stock ?? 'not tracked'} → ${product.stock}`,
                product.options !== match.options && 'options',
                product.description !== match.description && !match.description && 'description',
            ].filter((change): change is string => !!change);
            rows.push({ kind: 'update', key, product, existing: match, changes, sources, externalIds });
            continue;
        }
        // Not the same words as anything in the catalog: close to something, or new?
        let closest: CatalogProduct | null = null;
        let best = 0;
        for (const candidate of existing) {
            const score = nameSimilarity(candidate.name, product.name);
            if (score > best) [best, closest] = [score, candidate];
        }
        if (closest && best >= MAYBE_SAME) rows.push({ kind: 'maybe', key, product, existing: closest, sources, externalIds });
        else rows.push({ kind: 'new', key, product, sources, externalIds });
    }
    const order = { prices: 0, maybe: 1, new: 2, update: 3 } as const;
    return rows.sort((a, b) => order[a.kind] - order[b.kind]);
}

/** The owner's answers to the choices: a price for a 'prices' row, same-or-new for a 'maybe' row. */
export type MergeChoices = Record<string, { price?: number; same?: boolean }>;

/**
 * The catalog after the merge: what was there (updated where the import says
 * so) plus what's new, within the catalog's limit. Products the import didn't
 * mention are kept as they were.
 */
export function applyMerge(existing: CatalogProduct[], rows: MergeRow[], choices: MergeChoices): { products: CatalogProduct[]; added: number; updated: number; dropped: number } {
    const result = new Map(existing.map((product) => [product.id, product]));
    let added = 0;
    let updated = 0;
    for (const row of rows) {
        const choice = choices[row.key] ?? {};
        if (row.kind === 'update') {
            if (row.changes.length) {
                result.set(row.existing.id, { ...row.product, id: row.existing.id });
                updated++;
            }
        } else if (row.kind === 'prices') {
            const price = choice.price ?? row.prices[0].price;
            if (row.existing) {
                result.set(row.existing.id, { ...row.product, id: row.existing.id, price });
                updated++;
            } else {
                result.set(row.product.id, { ...row.product, price });
                added++;
            }
        } else if (row.kind === 'maybe') {
            if (choice.same) {
                result.set(row.existing.id, { ...row.existing, price: row.product.price, stock: row.product.stock ?? row.existing.stock, options: joinOptions(row.existing.options, row.product.options) });
                updated++;
            } else {
                result.set(row.product.id, row.product);
                added++;
            }
        } else {
            result.set(row.product.id, row.product);
            added++;
        }
    }
    const products = [...result.values()];
    const dropped = Math.max(0, products.length - PRODUCTS_MAX);
    return { products: products.slice(0, PRODUCTS_MAX), added: added - dropped, updated, dropped };
}

/** Which catalog product each store product became, after the owner's choices: store id → catalog id. */
export function productLinks(rows: MergeRow[], choices: MergeChoices): Record<string, string> {
    const links: Record<string, string> = {};
    for (const row of rows) {
        const id = row.kind === 'update' ? row.existing.id
            : row.kind === 'prices' ? (row.existing?.id ?? row.product.id)
                : row.kind === 'maybe' ? (choices[row.key]?.same ? row.existing.id : row.product.id)
                    : row.product.id;
        for (const externalId of row.externalIds) links[externalId] = id;
    }
    return links;
}
