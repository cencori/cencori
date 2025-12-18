import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

// Social media bot user agents that need fast OG response
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

// Minimal HTML response for social crawlers - just the essential meta tags
function createBotResponse(url: string): Response {
  const baseUrl = 'https://cencori.com';

  // Determine page-specific metadata
  let title = 'Cencori | The AI Infrastructure Platform';
  let description = 'The unified AI infrastructure for production applications. One API for every provider with built-in security, observability, and cost control.';
  let ogImage = `${baseUrl}/og-image.jpg`;
  let canonicalUrl = baseUrl;

  const pathname = new URL(url).pathname;

  // Add page-specific overrides if needed
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
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Cencori - The AI Infrastructure Platform">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Cencori">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@cencori">
  <meta name="twitter:creator" content="@cencori">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${ogImage}">
  <link rel="canonical" href="${canonicalUrl}">
</head>
<body></body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}

export async function middleware(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || '';

  // Check if this is a social media bot
  const isBot = SOCIAL_BOTS.some(bot => userAgent.includes(bot));

  // Serve minimal HTML to bots for fast OG preview (only for marketing pages)
  if (isBot) {
    const pathname = request.nextUrl.pathname;
    // Only serve bot response for public marketing pages, not dashboard/API routes
    const isMarketingPage = pathname === '/' ||
      pathname.startsWith('/ai') ||
      pathname.startsWith('/pricing') ||
      pathname.startsWith('/docs') ||
      pathname.startsWith('/blog') ||
      pathname.startsWith('/changelog');

    if (isMarketingPage) {
      return createBotResponse(request.url);
    }
  }

  // Create an unmodified response
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    },
  );

  // Refresh session if expired - this should be in your middleware
  // A simple example for session refreshing:
  await supabase.auth.getSession();

  return supabaseResponse;
}

