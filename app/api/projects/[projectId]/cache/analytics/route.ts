import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const { projectId } = await params;
    const url = new URL(req.url);
    const range = url.searchParams.get('range') || '7d';
    const environment = url.searchParams.get('environment') || 'production';

    const rangeMap: Record<string, number> = {
        '1h': 3600000,
        '24h': 86400000,
        '7d': 604800000,
        '30d': 2592000000,
    };

    const sinceMs = rangeMap[range] || rangeMap['7d'];
    const since = new Date(Date.now() - sinceMs).toISOString();

    const supabase = createAdminClient();

    // Get event counts by type
    let eventsQuery = supabase
        .from('prompt_cache_events')
        .select('event_type, tokens_saved, cost_saved_usd, created_at')
        .eq('project_id', projectId)
        .gte('created_at', since);

    // Filter by environment if the column exists (graceful for pre-migration data)
    eventsQuery = eventsQuery.eq('environment', environment);

    const { data: events } = await eventsQuery;

    const allEvents = events || [];
    const exactHits = allEvents.filter(e => e.event_type === 'hit_exact').length;
    const semanticHits = allEvents.filter(e => e.event_type === 'hit_semantic').length;
    const misses = allEvents.filter(e => e.event_type === 'miss').length;
    const totalLookups = exactHits + semanticHits + misses;
    const hitRate = totalLookups > 0 ? (exactHits + semanticHits) / totalLookups : 0;

    const totalTokensSaved = allEvents
        .filter(e => e.event_type === 'hit_exact' || e.event_type === 'hit_semantic')
        .reduce((sum, e) => sum + (e.tokens_saved || 0), 0);

    const totalCostSaved = allEvents
        .filter(e => e.event_type === 'hit_exact' || e.event_type === 'hit_semantic')
        .reduce((sum, e) => sum + (parseFloat(String(e.cost_saved_usd)) || 0), 0);

    // Hit rate over time (bucket by hour for 24h/1h, by day for 7d/30d)
    const bucketMs = sinceMs <= 86400000 ? 3600000 : 86400000;
    const buckets = new Map<string, { hits: number; total: number }>();

    for (const event of allEvents) {
        if (event.event_type !== 'hit_exact' && event.event_type !== 'hit_semantic' && event.event_type !== 'miss') continue;
        const ts = new Date(event.created_at);
        const bucketStart = new Date(Math.floor(ts.getTime() / bucketMs) * bucketMs).toISOString();

        if (!buckets.has(bucketStart)) {
            buckets.set(bucketStart, { hits: 0, total: 0 });
        }
        const bucket = buckets.get(bucketStart)!;
        bucket.total++;
        if (event.event_type !== 'miss') bucket.hits++;
    }

    const hitRateOverTime = Array.from(buckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([timestamp, { hits, total }]) => ({
            timestamp,
            hitRate: total > 0 ? hits / total : 0,
            lookups: total,
        }));

    // Top cached prompts
    const { data: topEntries } = await supabase
        .from('prompt_cache_entries')
        .select('id, prompt_text, model, hit_count, cost_saved_usd, last_hit_at')
        .eq('project_id', projectId)
        .gt('expires_at', new Date().toISOString())
        .order('hit_count', { ascending: false })
        .limit(10);

    const topCachedPrompts = (topEntries || []).map(e => ({
        id: e.id,
        promptPreview: e.prompt_text.slice(0, 120),
        model: e.model,
        hitCount: e.hit_count,
        costSaved: parseFloat(String(e.cost_saved_usd)) || 0,
        lastHitAt: e.last_hit_at,
    }));

    // Active entries count
    const { count: activeEntries } = await supabase
        .from('prompt_cache_entries')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .gt('expires_at', new Date().toISOString());

    return NextResponse.json({
        hitRate,
        totalLookups,
        exactHits,
        semanticHits,
        misses,
        totalTokensSaved,
        totalCostSaved,
        activeEntries: activeEntries || 0,
        hitRateOverTime,
        topCachedPrompts,
    });
}
