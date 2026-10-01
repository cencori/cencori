import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getProvider } from '@/lib/providers/config';

/**
 * GET /api/providers/:providerId/logo — public provider logo (SVG).
 *
 * No auth, CORS `*`, long cache. Always returns SVG for known providers so
 * third-party products can hotlink it directly:
 *
 *   <img src="https://cencori.com/api/providers/openai/logo" width="20" />
 *
 * Serves the checked-in brand mark from /public/providers when one exists,
 * otherwise a neutral monogram tile (initial on dark) so the <img> never
 * breaks. Unknown provider ids 404.
 *
 * NOTE: several brand marks are white (OpenAI, Anthropic) — render them on a
 * dark chip in the embedding product.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-static';
export const revalidate = 86400;

const LOGO_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400',
    'Content-Type': 'image/svg+xml',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: LOGO_HEADERS });
}

function escapeXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function monogramSvg(letter: string, name: string): string {
    const safe = escapeXml(letter.toUpperCase().slice(0, 1) || '?');
    const title = escapeXml(name);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img"><title>${title}</title><rect width="64" height="64" rx="14" fill="#18181b"/><text x="32" y="43" font-family="system-ui,-apple-system,sans-serif" font-size="30" font-weight="700" fill="#fafafa" text-anchor="middle">${safe}</text></svg>`;
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ providerId: string }> },
) {
    const { providerId } = await params;
    const id = decodeURIComponent(providerId ?? '').trim().toLowerCase();
    const provider = getProvider(id);

    if (!provider && id !== 'cencori') {
        return NextResponse.json({ error: `Unknown provider: ${providerId}` }, {
            status: 404,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=300',
            },
        });
    }

    const name = id === 'cencori' ? 'Cencori' : (provider?.name ?? id);

    // 1. Checked-in brand mark: /public/providers/<id>.svg
    try {
        const file = await readFile(path.join(process.cwd(), 'public', 'providers', `${id}.svg`), 'utf8');
        return new NextResponse(file, { headers: LOGO_HEADERS });
    } catch {
        // Fall through to provider.icon path, then monogram.
    }

    // 2. Provider's configured icon when it points at a local SVG.
    const icon = provider?.icon ?? '';
    if (icon.startsWith('/') && icon.endsWith('.svg')) {
        try {
            const file = await readFile(path.join(process.cwd(), 'public', decodeURIComponent(icon)), 'utf8');
            return new NextResponse(file, { headers: LOGO_HEADERS });
        } catch {
            // Fall through to monogram.
        }
    }

    // 3. Neutral monogram — never 404s for known providers.
    return new NextResponse(monogramSvg(name.slice(0, 1), name), { headers: LOGO_HEADERS });
}
