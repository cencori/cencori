import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabaseServer";

/**
 * Dashboard API: List memories in a namespace
 */

const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RouteParams = { params: Promise<{ projectId: string }> };

// GET: List memories
export async function GET(request: NextRequest, context: RouteParams) {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { projectId } = await context.params;
        const { searchParams } = new URL(request.url);
        const namespaceId = searchParams.get("namespace");
        const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
        const offset = parseInt(searchParams.get("offset") || "0");

        if (!namespaceId) {
            return NextResponse.json({ error: "namespace query param required" }, { status: 400 });
        }

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

        // Fetch memories (without embedding column)
        const { data: memories, error } = await adminClient
            .from("memories")
            .select("id, content, metadata, created_at")
            .eq("namespace_id", namespaceId)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.error("Error fetching memories:", error);
            return NextResponse.json({ error: "Failed to fetch memories" }, { status: 500 });
        }

        return NextResponse.json({ memories: memories || [] });
    } catch (error) {
        console.error("Error in memories GET:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
