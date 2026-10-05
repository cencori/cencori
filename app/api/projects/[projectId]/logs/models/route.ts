import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/require-project-access';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getProjectTier } from '@/lib/require-tier-feature';
import { clampTimeRange } from '@/lib/entitlements';

const RECENT_ROW_LIMIT = 1000;
const MAX_MODELS = 100;

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const supabaseAdmin = createAdminClient();
    const { projectId } = await params;
    const projectAccess = await requireProjectAccess(projectId);
    if (!projectAccess.ok) return projectAccess.response;

    try {
        const searchParams = req.nextUrl.searchParams;
        // Environments retired — ignored for backward compat.
        // History depth is tier-gated: free 7d, pro 30d, team 90d, enterprise all
        const tier = (await getProjectTier(projectId)) || 'free';
        const timeRange = clampTimeRange(tier, searchParams.get('time_range') || '90d');

        let startTime: Date | null = null;
        const now = new Date();

        switch (timeRange) {
            case '1h':
                startTime = new Date(now.getTime() - 60 * 60 * 1000);
                break;
            case '24h':
                startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            case 'all':
                startTime = null;
                break;
            default:
                startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        }

        let query = supabaseAdmin
            .from('ai_requests')
            .select('model')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(RECENT_ROW_LIMIT);

        if (startTime) {
            query = query.gte('created_at', startTime.toISOString());
        }

        const { data, error } = await query;

        if (error) {
            console.error('[Log Models API] Error fetching models:', error);
            return NextResponse.json(
                { error: 'Failed to fetch models' },
                { status: 500 }
            );
        }

        // De-dupe preserving recency order so the most recently used
        // models appear first in the filter dropdown.
        const seen = new Set<string>();
        const models: string[] = [];
        for (const row of data || []) {
            const model = (row as { model?: unknown }).model;
            if (typeof model !== 'string') continue;
            const name = model.trim();
            if (!name || seen.has(name)) continue;
            seen.add(name);
            models.push(name);
            if (models.length >= MAX_MODELS) break;
        }

        return NextResponse.json({ models });
    } catch (error) {
        console.error('[Log Models API] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
