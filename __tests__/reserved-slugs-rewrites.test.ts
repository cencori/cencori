/** @vitest-environment node */
import { readFileSync, readdirSync, statSync } from 'node:fs';
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

    // Same failure for pages: a top-level folder under app/ (or a route group)
    // that isn't reserved is served to nobody. Visitors get the console sign-in.
    it('reserves every top-level page folder', () => {
        const app = join(__dirname, '../app');
        const isRouteDir = (dir: string, name: string) =>
            statSync(join(dir, name)).isDirectory() && !/^[[(_@]/.test(name);
        const folders = new Set<string>();
        for (const entry of readdirSync(app)) {
            if (!statSync(join(app, entry)).isDirectory()) continue;
            if (entry.startsWith('(')) {
                const group = join(app, entry);
                for (const child of readdirSync(group)) if (isRouteDir(group, child)) folders.add(child);
            } else if (isRouteDir(app, entry)) {
                folders.add(entry);
            }
        }
        // Internal rewrite targets, reached only through the proxy's own host rewrites.
        const internal = new Set(['console-app']);
        const unreserved = [...folders].filter((f) => !internal.has(f) && !RESERVED_ORG_SLUGS.has(f.toLowerCase()));
        expect(unreserved).toEqual([]);
    });
});
