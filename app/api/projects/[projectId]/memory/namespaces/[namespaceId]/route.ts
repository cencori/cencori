import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabaseServer";

/**
 * Dashboard API: Delete a memory namespace
 */

const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RouteParams = { params: Promise<{ projectId: string; namespaceId: string }> };

// DELETE: Delete namespace and all its memories
export async function DELETE(request: NextRequest, context: RouteParams) {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { projectId, namespaceId } = await context.params;

        // Verify access
        const { data: project } = await adminClient
            .from("projects")
            .select("id, organization_id")
            .eq("id", projectId)
            .single();

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const { data: member } = await adminClient
            .from("organization_members")
            .select("role")
            .eq("organization_id", project.organization_id)
            .eq("user_id", user.id)
            .single();

        if (!member) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        // Verify namespace belongs to project
        const { data: namespace } = await adminClient
            .from("memory_namespaces")
            .select("id")
            .eq("id", namespaceId)
            .eq("project_id", projectId)
            .single();

        if (!namespace) {
            return NextResponse.json({ error: "Namespace not found" }, { status: 404 });
        }

        // Delete all memories first (cascade)
        await adminClient
            .from("memories")
            .delete()
            .eq("namespace_id", namespaceId);

        // Delete namespace
        const { error } = await adminClient
            .from("memory_namespaces")
            .delete()
            .eq("id", namespaceId);

        if (error) {
            console.error("Error deleting namespace:", error);
            return NextResponse.json({ error: "Failed to delete namespace" }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error in namespace DELETE:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
