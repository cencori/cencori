import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabaseServer";

/**
 * Dashboard API: List and create memory namespaces for a project
 * Uses session auth (not API key)
 */

// Admin client for DB operations
const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RouteParams = { params: Promise<{ projectId: string }> };

// GET: List namespaces for project
export async function GET(request: NextRequest, context: RouteParams) {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { projectId } = await context.params;

        // Verify user has access to this project
        const { data: project, error: projectError } = await adminClient
            .from("projects")
            .select("id, organization_id, organizations!inner(id)")
            .eq("id", projectId)
            .single();

        if (projectError || !project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        // Check org membership
        const { data: member } = await adminClient
            .from("organization_members")
            .select("role")
            .eq("organization_id", project.organization_id)
            .eq("user_id", user.id)
            .single();

        if (!member) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        // Get namespaces with memory count
        const { data: namespaces, error } = await adminClient
            .from("memory_namespaces")
            .select(`
                id,
                name,
                description,
                created_at,
                memories:memories(count)
            `)
            .eq("project_id", projectId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching namespaces:", error);
            return NextResponse.json({ error: "Failed to fetch namespaces" }, { status: 500 });
        }

        // Transform to include memory count
        const result = (namespaces || []).map((ns: Record<string, unknown>) => ({
            id: ns.id,
            name: ns.name,
            description: ns.description,
            created_at: ns.created_at,
            memory_count: Array.isArray(ns.memories) && ns.memories[0] ? (ns.memories[0] as { count: number }).count : 0,
        }));

        return NextResponse.json({ namespaces: result });
    } catch (error) {
        console.error("Error in namespaces GET:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// POST: Create namespace
export async function POST(request: NextRequest, context: RouteParams) {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { projectId } = await context.params;
        const body = await request.json();
        const { name, description } = body;

        if (!name || typeof name !== "string") {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        // Verify user has access
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

        // Create namespace
        const { data: namespace, error } = await adminClient
            .from("memory_namespaces")
            .insert({
                project_id: projectId,
                name: name.trim(),
                description: description?.trim() || null,
            })
            .select()
            .single();

        if (error) {
            if (error.code === "23505") {
                return NextResponse.json({ error: "Namespace already exists" }, { status: 409 });
            }
            console.error("Error creating namespace:", error);
            return NextResponse.json({ error: "Failed to create namespace" }, { status: 500 });
        }

        return NextResponse.json({ namespace }, { status: 201 });
    } catch (error) {
        console.error("Error in namespaces POST:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
