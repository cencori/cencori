import { NextResponse } from 'next/server';
import { checkCustomRateLimit } from '@/lib/rate-limit';

/**
 * Limits for the keyless assistants (docs Ask AI, Arcie docs, dashboard
 * Ask AI). They run on Cencori's own provider keys, so without limits anyone
 * could use them as a free model API. The per-IP limit keeps one visitor
 * reasonable; the global cap bounds total spend even if the IP is spoofed.
 */
const PER_IP_LIMIT = 20;
const PER_IP_WINDOW_SECONDS = 600;
const GLOBAL_LIMIT = 300;
const GLOBAL_WINDOW_SECONDS = 3600;

export const PUBLIC_AI_MAX_MESSAGES = 20;
export const PUBLIC_AI_MAX_CHARS = 4000;

function clientIp(req: Request): string {
    return req.headers.get('cf-connecting-ip')
        || req.headers.get('x-real-ip')
        || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || 'unknown';
}

/** Returns a 429 response when the caller is over a limit, else null. */
export async function limitPublicAi(req: Request, endpoint: string): Promise<NextResponse | null> {
    const [perIp, global] = await Promise.all([
        checkCustomRateLimit(`public_ai:${endpoint}:${clientIp(req)}`, PER_IP_LIMIT, PER_IP_WINDOW_SECONDS),
        checkCustomRateLimit(`public_ai:${endpoint}:global`, GLOBAL_LIMIT, GLOBAL_WINDOW_SECONDS),
    ]);
    if (perIp.allowed && global.allowed) return null;
    return NextResponse.json(
        { error: 'Too many questions right now. Try again in a few minutes.' },
        { status: 429 }
    );
}

/**
 * The last PUBLIC_AI_MAX_MESSAGES messages, each cut to PUBLIC_AI_MAX_CHARS,
 * or null when there's nothing usable. Long chats keep working; they just
 * stop growing the prompt we pay for.
 */
export function trimPublicAiMessages(messages: unknown): { role: string; content: string }[] | null {
    if (!Array.isArray(messages)) return null;
    const kept = messages
        .filter((m): m is { role: string; content: string } => typeof m?.content === 'string' && typeof m?.role === 'string')
        .slice(-PUBLIC_AI_MAX_MESSAGES)
        .map((m) => ({ role: m.role, content: m.content.slice(0, PUBLIC_AI_MAX_CHARS) }));
    return kept.length > 0 ? kept : null;
}
