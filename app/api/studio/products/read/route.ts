/**
 * POST /api/studio/products/read  { project_id, images?: [{ data, mime_type }], text? }
 *
 * Products from screenshots (a WhatsApp catalog, Instagram posts, a store
 * page), photos of a price list, or a pasted list: name, price, options,
 * stock, description, as data the owner reviews before anything is saved.
 * Up to six pictures a call; Studio sends more in turns. Pictures are resized
 * on the phone first and aren't kept. Runs on Cencori's own Gemini key.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/require-project-access';
import { getGoogleApiKey } from '@/lib/providers/google-env';
import { readProducts } from '@/lib/studio/read-products';

export const maxDuration = 60;

const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_TEXT = 30_000;
const FORMATS = ['image/jpeg', 'image/png', 'image/webp'];

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null) as { project_id?: unknown; images?: unknown; text?: unknown } | null;
    if (typeof body?.project_id !== 'string') return fail('Missing project.');
    const access = await requireProjectAccess(body.project_id);
    if (!access.ok) return access.response;

    const images = (Array.isArray(body.images) ? body.images : []).slice(0, MAX_IMAGES).flatMap((image) => {
        const { data, mime_type: mimeType } = (image ?? {}) as { data?: unknown; mime_type?: unknown };
        if (typeof data !== 'string' || typeof mimeType !== 'string' || !FORMATS.includes(mimeType)) return [];
        if (data.length * 0.75 > MAX_IMAGE_BYTES || !/^[A-Za-z0-9+/=]+$/.test(data)) return [];
        return [{ inlineData: { data, mimeType } }];
    });
    const text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_TEXT) : '';
    if (images.length === 0 && !text) return fail('Add screenshots, photos or a list.');

    const apiKey = getGoogleApiKey();
    if (!apiKey) return fail('Reading products isn\'t available right now. Try a spreadsheet instead.', 503);
    try {
        const products = await readProducts(apiKey, { images, text });
        return NextResponse.json({ products }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('[studio/products/read] read failed', error instanceof Error ? error.message : error);
        return fail('Couldn\'t read those just now. Try again.', 502);
    }
}
