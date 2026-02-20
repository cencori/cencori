import { NextResponse } from 'next/server'
import type { NextFetchEvent, NextRequest } from 'next/server'
import { createServerClient } from "@supabase/ssr"

// Supabase config
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;
const webLogIngestSecret = process.env.WEB_LOG_INGEST_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
const isProductionRuntime = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

// Security headers for all responses
const securityHeaders: Record<string, string> = {
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    // XSS Protection (legacy browsers)
    'X-XSS-Protection': '1; mode=block',
    // Control referrer information
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Restrict browser features
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    // Enforce HTTPS (HSTS) - 1 year with subdomains and preload
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    // Content Security Policy - prevent XSS and data injection
    'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://*.vercel-scripts.com",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https: blob:",
        "font-src 'self' data:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://vercel.live wss://vercel.live",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ].join('; '),
};

/**
 * Apply security headers to a response
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
    Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
    });
    return response;
}

function extractProjectScope(pathname: string): { orgSlug: string; projectSlug: string } | null {
    const match = pathname.match(/^\/dashboard\/organizations\/([^/]+)\/projects\/([^/]+)(?:\/|$)/);
    if (!match) return null;

    return { orgSlug: match[1], projectSlug: match[2] };
}

function isLocalhostHost(host: string): boolean {
    const normalized = host.toLowerCase();

    return (
        normalized === 'localhost'
        || normalized.startsWith('localhost:')
        || normalized === '127.0.0.1'
        || normalized.startsWith('127.0.0.1:')
        || normalized === '[::1]'
        || normalized.startsWith('[::1]:')
    );
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
    const hostname = request.headers.get('host') ?? '';
    const domain = hostname.split(':')[0];

    // 2. Determine Response (Rewrite vs Next)
    let response = NextResponse.next({
        request: { headers: request.headers },
    });

    const pathname = request.nextUrl.pathname;
    // Skip rewriting for static files (images, etc)
    // If it has a dot and isn't just a hidden file/folder (like .well-known), assume it's a file
    const isFile = pathname.includes('.') && !pathname.startsWith('/.well-known');

    if (!isFile) {
        // Handle pitch subdomain
        if (domain === 'pitch.cencori.com' || domain === 'pitch.localhost') {
            const url = request.nextUrl.clone();
            url.pathname = `/pitch${url.pathname}`;
            response = NextResponse.rewrite(url);
        }
        // Handle design subdomain
        else if (domain === 'design.cencori.com' || domain === 'design.localhost') {
            const url = request.nextUrl.clone();
            url.pathname = `/design${url.pathname}`;
            response = NextResponse.rewrite(url);
        }
        // Handle scan subdomain
        else if (domain === 'scan.cencori.com' || domain === 'scan.localhost') {
            const url = request.nextUrl.clone();
            url.pathname = `/scan${url.pathname}`;
            response = NextResponse.rewrite(url);
        }
    }

    // 3. Supabase Auth Session Refresh
    // Determine cookie domain for cross-subdomain auth
    const isProduction = domain.endsWith('.cencori.com') || domain === 'cencori.com';
    const cookieDomain = isProduction ? '.cencori.com' : undefined;

    const supabase = createServerClient(
        supabaseUrl,
        supabaseKey,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    response = NextResponse.next({ request })
                    // Note: If we had a rewrite, re-calling NextResponse.next() here effectively cancels the rewrite.
                    // We need to apply cookies to the EXISTING response object if possible.
                    // BUT createServerClient usage usually demands refreshing the response.
                    // WORKAROUND: Re-apply rewrite if response was a rewrite.
                    // Actually, we can just mutate the response.cookies.

                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, {
                            ...options,
                            domain: cookieDomain // Enable cross-subdomain auth
                        })
                    )
                },
            },
        }
    );

    // Refresh auth token
    await supabase.auth.getUser();

    // Apply security headers to all responses
    response = applySecurityHeaders(response);

    // Non-blocking web traffic logging for project-scoped dashboard routes.
    const projectScope = extractProjectScope(pathname);
    const skipLocalhostIngest = isProductionRuntime && isLocalhostHost(hostname);

    if (projectScope && webLogIngestSecret && !skipLocalhostIngest) {
        const requestId = crypto.randomUUID();
        const forwardedFor = request.headers.get('x-forwarded-for');
        const clientIp = forwardedFor?.split(',')[0]?.trim() || request.headers.get('x-real-ip');
        const queryString = request.nextUrl.searchParams.toString();
        const protocol = request.headers.get('x-forwarded-proto')
            || request.nextUrl.protocol.replace(':', '')
            || null;
        const runtimeEnv = process.env.VERCEL_ENV || process.env.NODE_ENV || null;

        const ingestUrl = new URL('/api/internal/web-logs/ingest', request.url);

        event.waitUntil(
            fetch(ingestUrl, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-cencori-internal-key': webLogIngestSecret,
                },
                body: JSON.stringify({
                    requestId,
                    orgSlug: projectScope.orgSlug,
                    projectSlug: projectScope.projectSlug,
                    host: hostname,
                    method: request.method,
                    path: pathname,
                    queryString: queryString || null,
                    statusCode: response.status,
                    message: `${pathname}${queryString ? `?${queryString}` : ''} status=${response.status}`,
                    userAgent: request.headers.get('user-agent'),
                    referer: request.headers.get('referer'),
                    ipAddress: clientIp || null,
                    countryCode: request.headers.get('x-vercel-ip-country') || null,
                    metadata: {
                        runtime: {
                            source: 'middleware',
                            env: runtimeEnv,
                        },
                        scope: {
                            org_slug: projectScope.orgSlug,
                            project_slug: projectScope.projectSlug,
                            query_count: request.nextUrl.searchParams.size,
                        },
                        connection: {
                            protocol,
                        },
                        request_headers: {
                            accept: request.headers.get('accept'),
                            accept_language: request.headers.get('accept-language'),
                            sec_fetch_site: request.headers.get('sec-fetch-site'),
                            sec_fetch_mode: request.headers.get('sec-fetch-mode'),
                            sec_fetch_dest: request.headers.get('sec-fetch-dest'),
                        },
                        vercel: {
                            request_id: request.headers.get('x-vercel-id'),
                            deployment_url: process.env.VERCEL_URL || null,
                            ip_city: request.headers.get('x-vercel-ip-city'),
                            ip_region: request.headers.get('x-vercel-ip-country-region'),
                            ip_continent: request.headers.get('x-vercel-ip-continent'),
                        },
                    },
                }),
            }).catch((error) => {
                console.error('[Web Logs] Failed to enqueue web request log:', error);
            })
        );
    }

    return response;
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
}
