/**
 * /api/billing/business
 *
 * Business plans (naira, per conversation) for an organization.
 *   GET   ?orgId=…                                the plan, its period and conversations used
 *   POST  { orgId, action: 'start_trial' }        make the organization a business, on the free trial
 *   POST  { orgId, action: 'checkout', plan }     a Bachs checkout for a 30-day pass
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerClient } from "@/lib/supabaseServer";
import { resolveConsoleBaseUrl } from "@/lib/auth-redirect";
import { isStudioHostname } from "@/lib/studio/routing";
import { createCheckoutSession, getBusinessPassProductId } from "@/lib/bachsClient";
import {
    BUSINESS_PLANS,
    PAID_BUSINESS_PLANS,
    conversationsUsed,
    getOrganizationPlan,
    startBusinessTrial,
    type PaidBusinessPlanId,
} from "@/lib/business/plans";
import { grantTrialCredit } from "@/lib/business/trial-credit";

type Admin = ReturnType<typeof createAdminClient>;

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

async function memberRole(db: Admin, organizationId: string, userId: string): Promise<"owner" | "admin" | "member" | null> {
    const { data: organization } = await db.from("organizations").select("owner_id").eq("id", organizationId).maybeSingle();
    if (!organization) return null;
    if (organization.owner_id === userId) return "owner";
    const { data: membership } = await db.from("organization_members").select("role").eq("organization_id", organizationId).eq("user_id", userId).maybeSingle();
    const role = membership?.role as string | undefined;
    return role === "owner" || role === "admin" ? role : membership ? "member" : null;
}

async function signedInUser() {
    const supabase = await createServerClient();
    const { data: { user }, error } = await getAuthUser(supabase);
    return error ? null : user;
}

export async function GET(req: NextRequest) {
    const user = await signedInUser();
    if (!user) return fail("Unauthorized", 401);
    const organizationId = req.nextUrl.searchParams.get("orgId") ?? "";
    const db = createAdminClient();
    if (!organizationId || !await memberRole(db, organizationId, user.id)) return fail("Organization not found", 404);

    const plan = await getOrganizationPlan(db, organizationId);
    const used = plan.accountType === "business" && plan.periodStart ? await conversationsUsed(db, organizationId, plan.periodStart) : 0;
    return NextResponse.json({
        account_type: plan.accountType,
        plan: plan.plan ? { id: plan.plan.id, name: plan.plan.name, conversations: plan.plan.conversations, agents: plan.plan.agents, all_models: plan.plan.allModels, price_ngn: plan.plan.priceNgn } : null,
        status: plan.status,
        active: plan.active,
        period_start: plan.periodStart,
        period_end: plan.periodEnd,
        conversations_used: used,
        plans: PAID_BUSINESS_PLANS.map((id) => ({ id, name: BUSINESS_PLANS[id].name, price_ngn: BUSINESS_PLANS[id].priceNgn, conversations: BUSINESS_PLANS[id].conversations, agents: BUSINESS_PLANS[id].agents, extras: BUSINESS_PLANS[id].extras, all_models: BUSINESS_PLANS[id].allModels })),
    }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
    const user = await signedInUser();
    if (!user?.email) return fail("Unauthorized", 401);
    const body = await req.json().catch(() => null) as { orgId?: unknown; action?: unknown; plan?: unknown } | null;
    const organizationId = typeof body?.orgId === "string" ? body.orgId : "";
    const db = createAdminClient();
    const role = organizationId ? await memberRole(db, organizationId, user.id) : null;
    if (!role) return fail("Organization not found", 404);
    if (role === "member") return fail("Only owners and admins can change the plan.", 403);

    if (body?.action === "start_trial") {
        // Every new business gets a little credit with its trial, once (setup tests on the plan's model).
        if (await startBusinessTrial(db, organizationId)) {
            await grantTrialCredit(organizationId);
        }
        return NextResponse.json({ ok: true });
    }

    if (body?.action === "checkout") {
        const plan = body.plan as PaidBusinessPlanId;
        if (!PAID_BUSINESS_PLANS.includes(plan)) return fail("Choose Starter, Growth or Business.");
        const { data: organization } = await db.from("organizations").select("name, billing_email").eq("id", organizationId).maybeSingle();
        // Bought from Studio (studio.cencori.com): back to Studio, which says the plan is on.
        const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
        const fromStudio = isStudioHostname(host);
        const studio = fromStudio ? `${req.nextUrl.protocol}//${host}` : null;
        const base = resolveConsoleBaseUrl(req.nextUrl.origin);
        try {
            const session = await createCheckoutSession({
                product_cart: [{ product_id: getBusinessPassProductId(plan), quantity: 1 }],
                customer: { email: (organization?.billing_email as string | null) || user.email, name: (organization?.name as string | null) || user.email.split("@")[0] },
                billing_currency: "NGN",
                success_url: studio ? `${studio}/?plan=paid` : `${base}/billing?business=paid`,
                cancel_url: studio ? `${studio}/` : `${base}/billing`,
                reference: `biz_${organizationId.replace(/-/g, "").slice(0, 16)}_${plan}_${Date.now().toString(36)}`,
                metadata: { org_id: organizationId, purchase_type: "business_pass", business_plan: plan },
            });
            return NextResponse.json({ url: session.checkout_url });
        } catch (error) {
            console.error("[Business checkout] Bachs checkout failed:", error);
            return fail("Couldn't open checkout. Try again in a moment.", 502);
        }
    }

    return fail("Unknown action.");
}
