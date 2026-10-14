/**
 * Internal: what a Compute machine shape costs us, and the cheapest equivalent on each cloud
 * CostGraph prices. Input to the v2 runtime placement decision.
 *
 * GET /api/internal/compute/placement-quote?memory_mb=512[&region=iad][&providers=AWS,Hetzner][&any_continent=1]
 * Internal access only (signed-in @cencori.com or an active cencori_admins row).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { checkInternalAccess } from '@/lib/internal-access';
import { getCencoriPricingClient } from '@/lib/finops/costgraph';
import { machineShape, quotePlacement } from '@/lib/compute/placement-pricing';

export async function GET(req: NextRequest) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await checkInternalAccess(user.id, user.email))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const client = getCencoriPricingClient();
    if (!client) {
        return NextResponse.json({ error: 'COSTGRAPH_API_KEY is not set' }, { status: 503 });
    }

    const url = new URL(req.url);
    const memoryMb = Number.parseInt(url.searchParams.get('memory_mb') ?? '', 10);
    const providers = (url.searchParams.get('providers') ?? '')
        .split(',').map((p) => p.trim()).filter(Boolean);

    try {
        const quote = await quotePlacement(
            client,
            machineShape(Number.isFinite(memoryMb) ? memoryMb : undefined, url.searchParams.get('region') ?? undefined),
            { providers, anyContinent: url.searchParams.get('any_continent') === '1' },
        );
        return NextResponse.json(quote);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Quote failed';
        console.error('[Compute] Placement quote failed:', message);
        return NextResponse.json({ error: message }, { status: 502 });
    }
}
