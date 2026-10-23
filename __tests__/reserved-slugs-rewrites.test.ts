/** @vitest-environment node */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RESERVED_ORG_SLUGS } from '@/lib/reserved-slugs';

// proxy.ts treats any unreserved first path segment as an org slug and
// redirects it to the console. A public API path rewritten in vercel.json
// must therefore be reserved, or every call to it gets a 308 instead.
describe('reserved org slugs', () => {
    it('reserves the first segment of every vercel.json API rewrite', () => {
        const { rewrites } = JSON.parse(readFileSync(join(__dirname, '../vercel.json'), 'utf8')) as {
            rewrites: Array<{ source: string; has?: unknown }>;
        };
        const firstSegments = new Set(
            rewrites.filter((r) => !r.has).map((r) => r.source.split('/').filter(Boolean)[0]),
        );
        const unreserved = [...firstSegments].filter((segment) => !RESERVED_ORG_SLUGS.has(segment));
        expect(unreserved).toEqual([]);
    });
});
