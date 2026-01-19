import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string; keyId: string }> }
) {
    try {
        const supabase = await createServerClient();
        const { projectId, keyId } = await params;

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        const { data: revokedKey, error: revokeError } = await supabase
            .from("api_keys")
            .update({ revoked_at: new Date().toISOString() })
            .eq("id", keyId)
            .eq("project_id", projectId)
            .is("revoked_at", null)
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

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string; keyId: string }> }
) {
    try {
        const supabase = await createServerClient();
        const { projectId, keyId } = await params;

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

        const { error: deleteError } = await supabase
            .from("api_keys")
            .delete()
            .eq("id", keyId)
            .eq("project_id", projectId)
            .not("revoked_at", "is", null);

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
