import vercelConfig from '../../vercel.json';

/**
 * Every public `/v1/...` path is a rewrite onto the route that serves it
 * (`/api/v1/...`, or `/api/ai/...` for the older endpoints), and a handler
 * behind a rewrite still sees the path the caller typed. Anything that decides
 * by path has to read the same path whichever spelling came in, so this maps
 * a public path to the one its handler lives at. vercel.json is the list the
 * rewrites themselves are built from.
 */
const RULES = (vercelConfig.rewrites as Array<{ source: string; destination: string; has?: unknown }>)
    .filter((rule) => !rule.has && rule.source.startsWith('/v1/'))
    .map(({ source, destination }) => {
        const wildcard = source.endsWith('/:path*');
        return {
            wildcard,
            source: wildcard ? source.slice(0, -':path*'.length) : source,
            destination: wildcard ? destination.slice(0, -':path*'.length) : destination,
        };
    });

export function canonicalGatewayPath(pathname: string): string {
    if (!pathname.startsWith('/v1/')) return pathname;
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
    // First match wins, as it does for the rewrites.
    for (const rule of RULES) {
        if (!rule.wildcard) {
            if (path === rule.source) return rule.destination;
        } else if (path.startsWith(rule.source) && path.length > rule.source.length) {
            return rule.destination + path.slice(rule.source.length);
        }
    }
    return pathname;
}
