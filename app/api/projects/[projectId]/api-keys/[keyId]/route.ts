import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/**
 * PATCH /api/projects/[projectId]/api-keys/[keyId]
 * Revoke an API key
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: { projectId: string; keyId: string } }
) {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        const { projectId, keyId } = params;

        // Get the current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Verify user has access to this project
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

        // Check if user owns the organization
        if (project.organizations[0].owner_id !== user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Revoke the key (soft delete)
        const { data: revokedKey, error: revokeError } = await supabase
            .from("api_keys")
            .update({ revoked_at: new Date().toISOString() })
            .eq("id", keyId)
            .eq("project_id", projectId)
            .is("revoked_at", null) // Only revoke if not already revoked
            .select()
            .single();

        if (revokeError || !revokedKey) {
            console.error("Error revoking API key:", revokeError);
            return NextResponse.json({ error: "Failed to revoke API key" }, { status: 500 });
        }

        return NextResponse.json({
            message: "API key revoked successfully",
            keyId: revokedKey.id,
        });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * DELETE /api/projects/[projectId]/api-keys/[keyId]
 * Permanently delete an API key (only if already revoked)
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: { projectId: string; keyId: string } }
) {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        const { projectId, keyId } = params;

        // Get the current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Verify user has access to this project
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

        // Check if user owns the organization
        if (project.organizations[0].owner_id !== user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Delete the key (only if already revoked for safety)
        const { error: deleteError } = await supabase
            .from("api_keys")
            .delete()
            .eq("id", keyId)
            .eq("project_id", projectId)
            .not("revoked_at", "is", null); // Only delete if already revoked

        if (deleteError) {
            console.error("Error deleting API key:", deleteError);
            return NextResponse.json({ error: "Failed to delete API key" }, { status: 500 });
        }

        return NextResponse.json({
            message: "API key deleted successfully",
        });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
