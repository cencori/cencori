import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { refreshPorterKnowledge } from "@/lib/porter/knowledge";

export const runtime = "nodejs";
// Several sites, fetched one page at a time, none of them ours to hurry.
export const maxDuration = 300;

/** How many Porters one sweep will look at. The rest come round on the next run. */
const PORTERS_PER_RUN = 20;

/**
 * The weekly refresh.
 *
 * A Porter answers from pages read once at setup, and a business that changes its prices or its
 * opening hours would otherwise have an assistant confidently quoting last month. This is what
 * makes "kept fresh weekly" true rather than a claim on a pricing page.
 *
 * Only Porters that are answering are refreshed. One that never finished its first crawl has
 * nothing to bring up to date.
 */
async function run(request: NextRequest) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.error("[Cron] Missing CRON_SECRET - refusing to run the Porter refresh");
        return NextResponse.json({ error: "Server misconfiguration" }, { status: 503 });
    }

    if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
        console.error("[Cron] Unauthorized Porter refresh attempt");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: porters, error } = await admin
        .from("porters")
        .select("id, organization_id, project_id, source_url")
        .eq("enabled", true)
        .order("updated_at", { ascending: true })
        .limit(PORTERS_PER_RUN);

    if (error) {
        console.error("[Cron] Could not list Porters:", error.message);
        return NextResponse.json({ error: "Could not list Porters" }, { status: 500 });
    }

    const results: Array<Record<string, unknown>> = [];

    for (const porter of porters ?? []) {
        try {
            const summary = await refreshPorterKnowledge(admin, porter);
            if (summary.checked > 0) {
                results.push({ porter: porter.id, host: porter.source_url, ...summary });
            }
        } catch (failure) {
            console.error("[Cron] Porter refresh failed for", porter.id, failure);
            results.push({ porter: porter.id, error: "refresh_failed" });
        }
    }

    return NextResponse.json({
        porters: porters?.length ?? 0,
        refreshed: results.length,
        results,
    });
}

export async function POST(request: NextRequest) {
    return run(request);
}

// Some schedulers only issue GETs; the secret is what authorises either way.
export async function GET(request: NextRequest) {
    return run(request);
}
