/**
 * GET /api/widget/config/:key
 *
 * What the loader script needs to draw the launcher on a customer's page.
 * Public and cacheable: it carries nothing beyond what the widget shows.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { isWidgetKey, sanitizeAppearance } from '@/lib/embedded/widget';
import { orbBackground } from '@/lib/agents/orb';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
    const { key } = await ctx.params;
    if (!isWidgetKey(key)) return NextResponse.json({ enabled: false }, { status: 404, headers: CORS });
    const db = createAdminClient();
    const { data } = await db.from('agent_widgets').select('enabled, appearance, agent_id, agents(name)').eq('public_key', key).maybeSingle();
    if (!data) return NextResponse.json({ enabled: false }, { status: 404, headers: CORS });
    const agentName = ((data as { agents?: { name?: string } | null }).agents?.name) ?? 'Assistant';
    const appearance = sanitizeAppearance((data as { appearance?: unknown }).appearance, agentName);
    return NextResponse.json(
        { enabled: (data as { enabled: boolean }).enabled, appearance, orb: orbBackground((data as { agent_id: string }).agent_id) },
        { headers: { ...CORS, 'Cache-Control': 'public, max-age=60, s-maxage=60' } },
    );
}
