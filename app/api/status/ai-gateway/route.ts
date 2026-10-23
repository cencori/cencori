import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

// Uptime-monitor probe for the AI Gateway (status.cencori.com). Answers 503
// when the gateway's database is unreachable, 200 otherwise.
//
// It used to go through getStatus(), which also read 11 provider circuit keys
// from Redis on every call: ~475k Upstash requests a month at OutRay's
// once-a-minute checks, against the plan's 500k cap. Those reads used the old
// per-provider keys (circuits are now per model), so they always came back
// empty and never affected the result. This keeps the one check that did.
export async function GET() {
  try {
    const { error } = await createAdminClient().from('projects').select('id').limit(1);
    const status = error ? 'down' : 'operational';
    return NextResponse.json({ status }, { status: error ? 503 : 200, headers: HEADERS });
  } catch (error) {
    console.error('[API] Error checking AI Gateway status:', error);
    return NextResponse.json({ status: 'unknown' }, { status: 503, headers: HEADERS });
  }
}
