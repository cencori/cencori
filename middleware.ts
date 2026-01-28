import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const hostname = request.headers.get('host') ?? ''

    // Handle pitch subdomain (Production & Local)
    if (hostname === 'pitch.cencori.com' || hostname.startsWith('pitch.localhost')) {
        const url = request.nextUrl.clone()
        // Rewrite to /pitch path
        url.pathname = `/pitch${url.pathname}`
        return NextResponse.rewrite(url)
    }

    // Handle design subdomain
    if (hostname === 'design.cencori.com' || hostname.startsWith('design.localhost')) {
        const url = request.nextUrl.clone()
        url.pathname = `/design${url.pathname}`
        return NextResponse.rewrite(url)
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
}
