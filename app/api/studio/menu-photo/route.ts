/**
 * POST /api/studio/menu-photo  { project_id, images: [{ data, mime_type }] }
 *
 * Setup's "Take a photo of your menu": reads a menu or price list from up to
 * four photos (pages) and writes it out as plain lines the owner can check
 * before it becomes what the assistant knows. The photos are resized on the
 * phone first and aren't kept. Runs on Cencori's own Gemini key.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireProjectAccess } from '@/lib/require-project-access';
import { getGoogleApiKey } from '@/lib/providers/google-env';

export const maxDuration = 60;

const MODEL = 'gemini-2.5-flash';
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const FORMATS = ['image/jpeg', 'image/png', 'image/webp'];

const PROMPT = `These are photos of a business's menu or price list. Write out everything on it as plain text, so a customer assistant can answer questions about it.

- One item per line: the name, then " — ", then the price exactly as written (keep the currency, e.g. ₦6,500). Add a short description after the price only if one is printed.
- Keep section headings (Starters, Drinks, Hair, ...) on their own line, followed by their items.
- Sizes or options with their own prices go on the item's line: "Jollof rice — ₦4,000 (small), ₦6,500 (large)".
- Copy only what's printed. Don't guess unreadable prices; write "price unclear" instead.
- No commentary, no Markdown, no introduction.

If the photos don't show a menu or price list, reply with exactly: NOT_A_MENU`;

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null) as { project_id?: unknown; images?: unknown } | null;
    if (typeof body?.project_id !== 'string') return fail('Missing project.');
    const access = await requireProjectAccess(body.project_id);
    if (!access.ok) return access.response;

    const images = (Array.isArray(body.images) ? body.images : []).slice(0, MAX_IMAGES).flatMap((image) => {
        const { data, mime_type: mimeType } = (image ?? {}) as { data?: unknown; mime_type?: unknown };
        if (typeof data !== 'string' || typeof mimeType !== 'string' || !FORMATS.includes(mimeType)) return [];
        if (data.length * 0.75 > MAX_IMAGE_BYTES || !/^[A-Za-z0-9+/=]+$/.test(data)) return [];
        return [{ inlineData: { data, mimeType } }];
    });
    if (images.length === 0) return fail('Add a photo of your menu or price list.');

    const apiKey = getGoogleApiKey();
    if (!apiKey) return fail('Reading photos isn\'t available right now. Type or paste your list instead.', 503);
    try {
        const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: MODEL, generationConfig: { temperature: 0, maxOutputTokens: 8192 } });
        const result = await model.generateContent([PROMPT, ...images]);
        const text = result.response.text().trim();
        if (!text || text.includes('NOT_A_MENU')) {
            return fail('That doesn\'t look like a menu or price list. Try a clearer photo, or type it instead.', 422);
        }
        return NextResponse.json({ text: text.slice(0, 20_000) }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('[studio/menu-photo] read failed', error instanceof Error ? error.message : error);
        return fail('Couldn\'t read the photo just now. Try again, or type your list instead.', 502);
    }
}
