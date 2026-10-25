/**
 * GET /api/copilot/usage?organizationId=...&days=30 — Copilot usage for an
 * organization over the last `days` days (1–90), per UTC day.
 *
 * Each answered question is a copilot_usage_events row: free inside the plan's
 * daily allowance, billed to credits past it (model cost + flat token rate).
 * Cost is what was billed; free questions count as messages but not cost.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerClient } from "@/lib/supabaseServer";
import { verifyOrganizationAccess } from "@/lib/copilot/access";
import { COPILOT_DAILY_LIMITS, PLAN_NAMES } from "@/lib/console/copilot";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;
/** Rows read per range; far above any realistic month of Copilot questions. */
const EVENT_ROW_CAP = 10_000;

interface EventRow {
    cost_usd: number | string;
    billed: boolean;
    created_at: string;
}

export async function GET(request: NextRequest) {
    const supabase = await createServerClient();
    const { data: { user } } = await getAuthUser(supabase);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const organizationId = request.nextUrl.searchParams.get("organizationId");
    if (!organizationId) return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    const requestedDays = Number.parseInt(request.nextUrl.searchParams.get("days") ?? "", 10);
    const windowDays = Number.isFinite(requestedDays) ? Math.min(MAX_DAYS, Math.max(1, requestedDays)) : DEFAULT_DAYS;

    const admin = createAdminClient();
    const organization = await verifyOrganizationAccess(organizationId, user.id, admin);
    if (!organization) return NextResponse.json({ error: "You do not have access to this organization." }, { status: 403 });

    const tier = organization.subscription_tier && organization.subscription_tier in COPILOT_DAILY_LIMITS
        ? organization.subscription_tier
        : "free";
    const limit = COPILOT_DAILY_LIMITS[tier];
    const today = new Date().toISOString().slice(0, 10);
    const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();

    const [eventsResult, todayResult] = await Promise.all([
        admin
            .from("copilot_usage_events")
            .select("cost_usd, billed, created_at")
            .eq("organization_id", organization.id)
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(EVENT_ROW_CAP),
        admin
            .from("copilot_daily_usage")
            .select("questions")
            .eq("subject", `org:${organization.id}`)
            .eq("day", today)
            .maybeSingle(),
    ]);

    // The events table arrives by migration (20261025_000000_copilot_usage_events),
    // applied by hand; until then there is simply no usage to show.
    const missingTable = eventsResult.error?.code === "42P01";
    if (eventsResult.error && !missingTable) {
        console.error("[Copilot] Usage read failed:", eventsResult.error.message);
        return NextResponse.json({ error: "We could not load Copilot usage." }, { status: 500 });
    }
    const events = (missingTable ? [] : eventsResult.data ?? []) as EventRow[];

    // One point per UTC day of the range, for the charts.
    const dayKeys: string[] = [];
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (windowDays - 1));
    for (let i = 0; i < windowDays; i++) {
        const day = new Date(start);
        day.setUTCDate(start.getUTCDate() + i);
        dayKeys.push(day.toISOString().slice(0, 10));
    }
    const byDay = new Map(dayKeys.map((key) => [key, { messages: 0, billedUsd: 0 }]));
    for (const event of events) {
        const point = byDay.get(event.created_at.slice(0, 10));
        if (!point) continue;
        point.messages += 1;
        if (event.billed) point.billedUsd += Number(event.cost_usd) || 0;
    }

    return NextResponse.json({
        plan: { tier, name: PLAN_NAMES[tier] ?? tier },
        // Free questions per day; null = unlimited.
        freeQuestionsPerDay: limit > 0 ? limit : null,
        questionsToday: Number(todayResult.data?.questions ?? 0),
        days: windowDays,
        billedUsd: events.reduce((sum, event) => sum + (event.billed ? Number(event.cost_usd) || 0 : 0), 0),
        messages: events.length,
        daily: dayKeys.map((date) => ({ date, ...byDay.get(date)! })),
    });
}
