import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from "@supabase/ssr"

// Social media bot user agents
const SOCIAL_BOTS = [
    'Twitterbot',
    'facebookexternalhit',
    'LinkedInBot',
    'Slackbot',
    'Discordbot',
    'TelegramBot',
    'WhatsApp',
    'Applebot',
    'Pinterestbot',
];

// Supabase config
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

function createBotResponse(url: string): Response {
    const baseUrl = 'https://cencori.com';
    let title = 'Cencori | The Infrastructure for AI Production';
    let description = 'Ship AI with built-in security, observability, and scale. One platform for everything.';
    const ogImage = `${baseUrl}/og-image.jpg`;
    let canonicalUrl = baseUrl;

    const pathname = new URL(url).pathname;

    if (pathname.startsWith('/ai')) {
        title = 'AI Gateway | Cencori';
        description = 'The inline proxy between your applications and LLMs. Inspect, redact, sanitize, or block content in real-time.';
        canonicalUrl = `${baseUrl}/ai`;
    } else if (pathname.startsWith('/pricing')) {
        title = 'Pricing | Cencori';
        canonicalUrl = `${baseUrl}/pricing`;
    } else if (pathname.startsWith('/docs')) {
        title = 'Documentation | Cencori';
        canonicalUrl = `${baseUrl}/docs`;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="${canonicalUrl}">
</head>
<body></body>
</html>`;

    return new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
}

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

export async function middleware(request: NextRequest) {
    const userAgent = request.headers.get('user-agent') || '';
    const hostname = request.headers.get('host') ?? '';
    const domain = hostname.split(':')[0];

    // 1. Bot Check (Early Return)
    const isBot = SOCIAL_BOTS.some(bot => userAgent.includes(bot));
    if (isBot) {
        const pathname = request.nextUrl.pathname;
        const isMarketingPage = pathname === '/' ||
            pathname.startsWith('/ai') ||
            pathname.startsWith('/pricing') ||
            pathname.startsWith('/docs') ||
            pathname.startsWith('/blog') ||
            pathname.startsWith('/changelog');

        if (isMarketingPage) return createBotResponse(request.url);
    }

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
            const isGlobalRoute = ['/login', '/sign-in', '/sign-up', '/dashboard', '/docs', '/api', '/sso-callback', '/scan'].some(path => pathname.startsWith(path));

            if (!isGlobalRoute) {
                const url = request.nextUrl.clone();
                url.pathname = `/scan${url.pathname}`;
                response = NextResponse.rewrite(url);
            }
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
    return applySecurityHeaders(response);
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
}
