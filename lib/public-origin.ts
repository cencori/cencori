import type { NextRequest } from 'next/server';

function normalizeOrigin(value: string | undefined | null): string | null {
    if (!value) return null;
    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
}

function extractFirstHeaderValue(value: string | null): string | null {
    if (!value) return null;
    const first = value.split(',')[0]?.trim();
    return first || null;
}

export function resolvePublicOrigin(req: NextRequest): string {
    const forwardedHost = extractFirstHeaderValue(req.headers.get('x-forwarded-host'));
    const forwardedProto = extractFirstHeaderValue(req.headers.get('x-forwarded-proto'));

    if (forwardedHost) {
        const protocol = forwardedProto || (forwardedHost.includes('localhost') ? 'http' : 'https');
        return `${protocol}://${forwardedHost}`;
    }

    const host = req.headers.get('host');
    if (host) {
        const protocol = host.includes('localhost') ? 'http' : 'https';
        return `${protocol}://${host}`;
    }

    const requestOrigin = normalizeOrigin(req.nextUrl?.origin);
    if (requestOrigin) {
        return requestOrigin;
    }

    const envOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);
    if (envOrigin) {
        return envOrigin;
    }

    return 'http://localhost:3000';
}
