import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { PorterRefreshError, refreshPorterKnowledge, type PorterRefreshSummary } from "@/lib/porter/knowledge";

export const runtime = "nodejs";
// Several sites, fetched one page at a time, none of them ours to hurry.
export const maxDuration = 300;

/** How many Porters one sweep will look at. The rest come round on the next run. */
const PORTERS_PER_RUN = 20;
// Leave a minute for the current page and the final lease release before the platform timeout.
const WORK_BUDGET_MS = 240_000;

type ClaimedPorter = {
    id: string;
    organization_id: string;
    project_id: string;
    source_url: string;
    lease_token: string;
};

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
    const deadlineMs = Date.now() + WORK_BUDGET_MS;
    const processed: string[] = [];
    const results: Array<Record<string, unknown>> = [];
    const errors: string[] = [];
    let refreshed = 0;
    let failed = 0;

    while (processed.length < PORTERS_PER_RUN && Date.now() < deadlineMs) {
        let porter: ClaimedPorter;
        try {
            // Claim only work that can start now; the database skips idle sites and active leases.
            const { data, error } = await admin.rpc("claim_porter_recrawl", { p_exclude_ids: [...processed] });
            if (error) throw new Error(error.message);
            const claimed = (data as ClaimedPorter[] | null)?.[0];
            if (!claimed) break;
            porter = claimed;
            processed.push(porter.id);
        } catch (failure) {
            console.error("[Cron] Could not claim a Porter refresh:", failure);
            errors.push("claim_failed");
            failed += 1;
            break;
        }

        let summary: PorterRefreshSummary | null = null;
        let refreshError: string | null = null;
        let releaseError: string | null = null;
        try {
            summary = await refreshPorterKnowledge(admin, porter, undefined, { deadlineMs });
            if (summary.failed > 0) refreshError = `${summary.failed} page(s) could not be refreshed`;
        } catch (failure) {
            console.error("[Cron] Porter refresh failed for", porter.id, failure);
            refreshError = failure instanceof Error ? failure.message : "refresh_failed";
            if (failure instanceof PorterRefreshError) summary = failure.summary;
        }

        try {
            const { data, error } = await admin.rpc("finish_porter_recrawl", {
                p_porter_id: porter.id,
                p_lease_token: porter.lease_token,
                p_summary: summary,
                p_error: refreshError,
            });
            if (error) throw new Error(error.message);
            if (data !== true) throw new Error("Porter refresh lease was replaced before completion");
        } catch (failure) {
            console.error("[Cron] Could not finish Porter refresh for", porter.id, failure);
            releaseError = "release_failed";
        }

        if (summary && summary.checked > 0) refreshed += 1;
        if (refreshError || releaseError) failed += 1;
        results.push({
            porter: porter.id,
            host: porter.source_url,
            ...summary,
            ...(refreshError ? { error: refreshError } : {}),
            ...(releaseError ? { release_error: releaseError } : {}),
        });
    }

    return NextResponse.json({
        porters: processed.length,
        refreshed,
        failed,
        deadlineReached: Date.now() >= deadlineMs,
        results,
        ...(errors.length ? { errors } : {}),
    }, { status: failed > 0 ? 500 : 200 });
}

export async function POST(request: NextRequest) {
    return run(request);
}

// Some schedulers only issue GETs; the secret is what authorises either way.
export async function GET(request: NextRequest) {
    return run(request);
}
