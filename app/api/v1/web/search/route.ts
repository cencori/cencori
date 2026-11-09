import { NextRequest } from 'next/server';
import { handleCorsPreFlight } from '@/lib/gateway-middleware';
import { WebRuntimeError } from '@/lib/web/errors';
import { runWebRoute } from '@/lib/web/http';
import { liveWebSearch, takeWebSearchSlot } from '@/lib/web/live-search';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function OPTIONS() {
    return handleCorsPreFlight();
}

export async function POST(req: NextRequest) {
    return runWebRoute(req, 'web/search', async (body, ctx) => {
        if (typeof body.query !== 'string' || !body.query.trim()) {
            throw new WebRuntimeError('invalid_query', 'query is required');
        }
        // A per-project allowance: one project can't use up search for everyone.
        const slot = await takeWebSearchSlot(ctx.projectId, ctx.tier);
        if (!slot.allowed) {
            throw new WebRuntimeError('rate_limited', `This project can run ${slot.limit} web searches a minute on its plan. Try again shortly.`, 429, {
                limit: slot.limit,
                retry_after_seconds: Math.max(1, Math.ceil((slot.reset - Date.now()) / 1000)),
            });
        }
        const results = await liveWebSearch(body.query, {
            limit: typeof body.limit === 'number' ? body.limit : undefined,
            domain: typeof body.domain === 'string' ? body.domain : undefined,
            freshness: typeof body.freshness === 'string' ? body.freshness : undefined,
            language: typeof body.language === 'string' ? body.language : undefined,
        });
        return {
            body: {
                query: body.query.trim(),
                results,
                count: results.length,
                searchEngine: 'tinyfish-search-v1',
            },
            metadata: { query_length: body.query.length, results: results.length },
        };
    });
}
