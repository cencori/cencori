/**
 * Keep Cencori's model rates current in CostGraph's pricing marketplace: every active
 * model_pricing row, one marketplace row per token bucket under `host: "cencori"`. Diffed, so
 * an unchanged catalogue writes nothing. (Compute machine rates went with Compute, 2026-11-06.)
 *
 * Needs COSTGRAPH_API_KEY (Cencori's own key, pricing:read + pricing:write).
 *
 * GET|POST /api/cron/costgraph-marketplace[?dry_run=1][&prune=1]   (Authorization: Bearer $CRON_SECRET)
 *   dry_run — report the changes without writing.
 *   prune   — also delete published rows for models Cencori no longer sells.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cronDisabled } from '@/lib/cron';
import { getAllActivePricing } from '@/lib/providers/pricing';
import { getCencoriPricingClient } from '@/lib/finops/costgraph';
import { syncModelPrices } from '@/lib/finops/costgraph-marketplace';

export const maxDuration = 300;

function flag(url: URL, name: string): boolean {
    const value = url.searchParams.get(name);
    return value === '1' || value === 'true';
}

async function run(req: NextRequest) {
    const off = cronDisabled();
    if (off) return off;
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.error('[Cron] Missing CRON_SECRET - refusing to run CostGraph marketplace sync');
        return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 });
    }
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        console.error('[Cron] Unauthorized CostGraph marketplace sync attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = getCencoriPricingClient();
    if (!client) {
        return NextResponse.json({ success: false, skipped: 'COSTGRAPH_API_KEY is not set' }, { status: 200 });
    }

    const url = new URL(req.url);
    const dryRun = flag(url, 'dry_run');

    try {
        const catalogue = await getAllActivePricing();
        const models = await syncModelPrices({ client, catalogue, dryRun, prune: flag(url, 'prune') });

        return NextResponse.json({
            success: true,
            dryRun,
            models: { ...models, catalogueModels: catalogue.length, changes: models.changes.slice(0, 200) },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        console.error('[Cron] CostGraph marketplace sync failed:', message);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    return run(req);
}

export async function POST(req: NextRequest) {
    return run(req);
}
