import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerClient } from "@/lib/supabaseServer";
import { writeAuditLog } from "@/lib/audit-log";

async function getProjectWithAccess(projectId: string) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { error: "Unauthorized", status: 401 };

    const admin = createAdminClient();
    const { data: project } = await admin
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

    if (!project) return { error: "Project not found", status: 404 };

    const { data: membership } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", project.organization_id)
        .eq("user_id", user.id)
        .single();

    if (!membership) return { error: "Insufficient permissions", status: 403 };

    return { project, user, admin, isAdmin: ["owner", "admin"].includes(membership.role) };
}

// GET — retrieve end-user billing configuration
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const { projectId } = await params;
    const result = await getProjectWithAccess(projectId);
    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { project } = result;
    return NextResponse.json({
        end_user_billing_enabled: project.end_user_billing_enabled ?? false,
        default_rate_plan_id: project.default_rate_plan_id ?? null,
        customer_markup_percentage: project.customer_markup_percentage ?? 0,
        billing_cycle: project.billing_cycle ?? "monthly",
    });
}

// PATCH — update end-user billing configuration
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const { projectId } = await params;
    const result = await getProjectWithAccess(projectId);
    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { project, user, admin, isAdmin } = result;

    if (!isAdmin) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const updates: Record<string, unknown> = {};

        if ("end_user_billing_enabled" in body) {
            updates.end_user_billing_enabled = Boolean(body.end_user_billing_enabled);
        }

        if ("default_rate_plan_id" in body) {
            updates.default_rate_plan_id = body.default_rate_plan_id === null ? null : String(body.default_rate_plan_id);
        }

        if ("customer_markup_percentage" in body) {
            const markup = parseFloat(body.customer_markup_percentage);
            if (isNaN(markup) || markup < 0 || markup > 1000) {
                return NextResponse.json({ error: "Invalid markup (must be 0–1000)" }, { status: 400 });
            }
            updates.customer_markup_percentage = markup;
        }

        if ("billing_cycle" in body) {
            const validCycles = ["monthly", "weekly", "daily"];
            if (!validCycles.includes(body.billing_cycle)) {
                return NextResponse.json({ error: `Invalid billing_cycle (${validCycles.join(", ")})` }, { status: 400 });
            }
            updates.billing_cycle = body.billing_cycle;
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
        }

        const { error } = await admin
            .from("projects")
            .update(updates)
            .eq("id", projectId);

        if (error) {
            console.error("[EndUserBilling] PATCH error:", error);
            return NextResponse.json({ error: "Failed to update billing config" }, { status: 500 });
        }

        writeAuditLog({
            organizationId: project.organization_id,
            projectId,
            category: "billing",
            action: "updated",
            resourceType: "end_user_billing_config",
            resourceId: projectId,
            actorId: user.id,
            actorEmail: user.email ?? null,
            actorIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
            actorType: "user",
            description: "Updated end-user billing configuration",
            metadata: { changes: updates },
        });

        // Return the updated values (merge updates over stale project data)
        return NextResponse.json({
            success: true,
            end_user_billing_enabled: updates.end_user_billing_enabled ?? project.end_user_billing_enabled ?? false,
            default_rate_plan_id: updates.default_rate_plan_id !== undefined ? updates.default_rate_plan_id : (project.default_rate_plan_id ?? null),
            customer_markup_percentage: updates.customer_markup_percentage ?? project.customer_markup_percentage ?? 0,
            billing_cycle: updates.billing_cycle ?? project.billing_cycle ?? "monthly",
        });
    } catch (error) {
        console.error("[EndUserBilling] PATCH error:", error);
        return NextResponse.json({ error: "Failed to update billing configuration" }, { status: 500 });
    }
}
