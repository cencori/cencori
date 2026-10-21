import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_PROVIDERS } from '../config';

const MIGRATIONS_DIR = join(__dirname, '../../../supabase/migrations');

// The dashboard offers BYOK for every SUPPORTED_PROVIDERS entry, but the DB only
// accepts vendors in provider_keys_provider_check. Read the newest migration
// that defines that constraint and make sure it still covers the catalog.
function latestAllowedVendors(): { file: string; vendors: Set<string> } {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files.reverse()) {
        const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
        const match = sql.match(/ADD CONSTRAINT provider_keys_provider_check CHECK \(provider IN \(([\s\S]*?)\)\)/);
        if (match) {
            const vendors = new Set([...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
            return { file, vendors };
        }
    }
    throw new Error('no migration defines provider_keys_provider_check');
}

describe('provider_keys vendor CHECK', () => {
    it('allows every SUPPORTED_PROVIDERS id', () => {
        const { file, vendors } = latestAllowedVendors();
        const missing = SUPPORTED_PROVIDERS.map((p) => p.id).filter((id) => !vendors.has(id));
        expect(missing, `add these to a new provider_keys_provider_check migration (latest: ${file})`).toEqual([]);
    });
});
