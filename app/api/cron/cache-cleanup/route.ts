import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const now = new Date().toISOString();

    // Delete expired cache entries
    const { data: expired } = await supabase
        .from('prompt_cache_entries')
        .select('id, project_id')
        .lt('expires_at', now);

    if (expired && expired.length > 0) {
        const ids = expired.map(e => e.id);

        // Log eviction events
        const evictionEvents = expired.map(e => ({
            project_id: e.project_id,
            cache_entry_id: e.id,
            event_type: 'evict' as const,
        }));

        await supabase.from('prompt_cache_events').insert(evictionEvents);

        // Delete entries
        await supabase
            .from('prompt_cache_entries')
            .delete()
            .in('id', ids);
    }

    // Clean up old events (older than 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    await supabase
        .from('prompt_cache_events')
        .delete()
        .lt('created_at', thirtyDaysAgo);

    return NextResponse.json({
        expired_entries_cleaned: expired?.length || 0,
        timestamp: now,
    });
}
