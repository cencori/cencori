import { getAuthUser } from "@/lib/auth/get-auth-user";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { trackEvent } from "@/lib/track-event";
import { writeAuditLog } from "@/lib/audit-log";

/**
 * Rename an API key and/or limit which models it may call.
 * Same rules as revoking: org owners only, active keys only, audit-logged.
 * Body: { name?: string; allowed_models?: string[] | null } — null clears
 * the restriction (all models allowed).
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string; keyId: string }> }
) {
    try {
        const supabase = await createServerClient();
        const { projectId, keyId } = await params;

        const { data: { user }, error: userError } = await getAuthUser(supabase);
        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await request.json().catch(() => null)) as {
            name?: unknown;
            allowed_models?: unknown;
        } | null;

        const update: { name?: string; allowed_models?: string[] | null } = {};
        if (body && "name" in body) {
            if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 100) {
                return NextResponse.json({ error: "Name must be 1-100 characters" }, { status: 400 });
            }
            update.name = body.name.trim();
        }
        if (body && "allowed_models" in body) {
            if (body.allowed_models === null) {
                update.allowed_models = null;
            } else if (
                Array.isArray(body.allowed_models)
                && body.allowed_models.length > 0
                && body.allowed_models.length <= 100
                && body.allowed_models.every((m) => typeof m === "string" && m.trim().length > 0 && m.length <= 200)
            ) {
                update.allowed_models = [...new Set((body.allowed_models as string[]).map((m) => m.trim()))];
            } else {
                return NextResponse.json({ error: "allowed_models must be a non-empty list of model ids, or null" }, { status: 400 });
            }
        }
        if (Object.keys(update).length === 0) {
            return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
        }

        const { data: project, error: projectError } = await supabase
            .from("projects")
            .select(`
        id,
        organization_id,
        organizations!inner(owner_id)
      `)
            .eq("id", projectId)
            .single();

        if (projectError || !project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const orgOwner = (project.organizations as { owner_id?: string })?.owner_id;
        if (!orgOwner || orgOwner !== user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { data: updatedKey, error: updateError } = await supabase
            .from("api_keys")
            .update(update)
            .eq("id", keyId)
            .eq("project_id", projectId)
            .is("revoked_at", null)
            .select("id, name, key_prefix, allowed_models")
            .single();

        if (updateError || !updatedKey) {
            console.error("Error updating API key:", updateError);
            return NextResponse.json({ error: "Failed to update API key" }, { status: 500 });
        }

        trackEvent({ event_type: "api_key.updated", product: "gateway", user_id: user.id, project_id: projectId, metadata: { key_id: keyId, fields: Object.keys(update) } });

        writeAuditLog({
            organizationId: project.organization_id,
            projectId,
            category: "api_key",
            action: "updated",
            resourceType: "api_key",
            resourceId: keyId,
            actorId: user.id,
            actorEmail: user.email || null,
            actorIp: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
            actorType: "user",
            description: `Updated API key "${updatedKey.name}" (${updatedKey.key_prefix})`,
            metadata: { key_prefix: updatedKey.key_prefix, ...update },
        });

        return NextResponse.json({ apiKey: updatedKey });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
