import type { NextRequest } from 'next/server';
import { studioOrigin } from '@/lib/studio/routing';

/** Where Meta returns to: Studio's own address, so the owner's sign-in comes along. */
export function studioCallbackUrl(req: NextRequest): string {
    return `${studioOrigin(req.headers.get('host') ?? 'studio.cencori.com')}/api/studio/whatsapp/callback`;
}

/** Only these Studio pages can be returned to. */
export function returnPath(value: string | null | undefined): '/' | '/setup' {
    return value === '/setup' ? '/setup' : '/';
}

/** Back to Studio (Home or setup) with how it went (?whatsapp=connected or failed, and why). */
export function studioHome(req: NextRequest, path: '/' | '/setup' = '/') {
    const origin = studioOrigin(req.headers.get('host') ?? 'studio.cencori.com');
    return (outcome: 'connected' | 'failed', message?: string) => {
        const params = new URLSearchParams({ whatsapp: outcome, via: 'meta', ...(message ? { message: message.slice(0, 200) } : {}) });
        return `${origin}${path}?${params}`;
    };
}
