import { getAuthUser } from "@/lib/auth/get-auth-user";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkInternalAccess } from "@/lib/internal-access";

/**
 * Platform-wide time series for the internal Overview charts. One call to
 * analytics_platform_series (database/brimble/0600_analytics_platform_series.sql),
 * which buckets in SQL.
 */

const PERIODS = {
    "1h": { ms: 60 * 60 * 1000, bucket: "5 minutes" },
    "24h": { ms: 24 * 60 * 60 * 1000, bucket: "1 hour" },
    "7d": { ms: 7 * 24 * 60 * 60 * 1000, bucket: "1 day" },
    "30d": { ms: 30 * 24 * 60 * 60 * 1000, bucket: "1 day" },
    "90d": { ms: 90 * 24 * 60 * 60 * 1000, bucket: "1 day" },
    "1y": { ms: 365 * 24 * 60 * 60 * 1000, bucket: "7 days" },
    all: { ms: null, bucket: "7 days" },
} as const;

type Period = keyof typeof PERIODS;

export async function GET(req: NextRequest) {
    const supabase = await createServerClient();
    const { data: { user } } = await getAuthUser(supabase);
    if (!user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await checkInternalAccess(user.id, user.email))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const requested = new URL(req.url).searchParams.get("period") ?? "7d";
    const period: Period = requested in PERIODS ? (requested as Period) : "7d";
    const { ms, bucket } = PERIODS[period];
    const start = ms === null ? new Date(0) : new Date(Date.now() - ms);

    const { data, error } = await createAdminClient().rpc("analytics_platform_series", {
        p_start: start.toISOString(),
        p_bucket: bucket,
    });

    if (error) {
        console.error("[Analytics] RPC analytics_platform_series failed:", error.message);
        // PGRST202: the function isn't in this database (e.g. a local copy
        // that predates it). Say so instead of drawing empty charts.
        const missing = error.code === "PGRST202";
        return NextResponse.json(
            { error: missing ? "not_installed" : "query_failed" },
            { status: missing ? 501 : 500 },
        );
    }

    return NextResponse.json({ period, bucket, ...(data as object) });
}
