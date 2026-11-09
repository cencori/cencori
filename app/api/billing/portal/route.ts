/**
 * POST /api/billing/portal  { orgId }
 *
 * A Bachs customer-portal link for the org: its subscription, cards and
 * invoices. Owners and admins only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerClient } from "@/lib/supabaseServer";
import { createPortalSession } from "@/lib/bachsClient";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await getAuthUser(supabase);
  if (userError || !user) return fail("Unauthorized", 401);

  const body = (await req.json().catch(() => null)) as { orgId?: unknown } | null;
  const orgId = typeof body?.orgId === "string" ? body.orgId : null;
  if (!orgId) return fail("Choose an organization");

  const admin = createAdminClient();
  const { data: organization, error: orgError } = await admin
    .from("organizations")
    .select("id, owner_id, bachs_customer_id")
    .eq("id", orgId)
    .maybeSingle();
  if (orgError || !organization) return fail("Organization not found", 404);

  let canManageBilling = organization.owner_id === user.id;
  if (!canManageBilling) {
    const { data: membership, error: membershipError } = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membershipError) {
      console.error("[Billing Portal] Permission lookup failed:", membershipError);
      return fail("Could not verify billing permissions", 500);
    }
    canManageBilling = membership?.role === "owner" || membership?.role === "admin";
  }
  if (!canManageBilling) return fail("Only organization owners and admins can manage billing", 403);

  if (!organization.bachs_customer_id) {
    return fail("This organization has no billing account yet. It's created with the first payment.", 409);
  }

  try {
    const session = await createPortalSession(organization.bachs_customer_id as string);
    return NextResponse.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Billing Portal] Bachs portal session failed:", error);
    return fail("The billing portal is temporarily unavailable. Try again in a moment.", 502);
  }
}
