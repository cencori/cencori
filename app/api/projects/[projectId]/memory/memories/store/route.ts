import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

interface RouteParams {
    params: Promise<{ projectId: string }>;
}

// Helper to get authenticated user
async function getAuthUser() {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

// Admin client for DB operations
const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST: Store a new memory
export async function POST(request: NextRequest, context: RouteParams) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { projectId } = await context.params;
        const body = await request.json();
        const { namespace_id, content, metadata } = body;

        if (!namespace_id) {
            return NextResponse.json({ error: "Namespace ID is required" }, { status: 400 });
        }

        if (!content || typeof content !== "string") {
            return NextResponse.json({ error: "Content is required" }, { status: 400 });
        }

        // Verify user has access to project
        const { data: project, error: projectError } = await adminClient
            .from("projects")
            .select("id, organization_id")
            .eq("id", projectId)
            .single();

        if (projectError || !project) {
            console.error("Project lookup failed:", projectError);
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        // Check user is member of organization
        const { data: member, error: memberError } = await adminClient
            .from("organization_members")
            .select("role")
            .eq("organization_id", project.organization_id)
            .eq("user_id", user.id)
            .single();

        console.log("Membership check:", { userId: user.id, orgId: project.organization_id, member, memberError });

        if (!member) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        // Verify namespace belongs to project
        const { data: namespace } = await adminClient
            .from("memory_namespaces")
            .select("id")
            .eq("id", namespace_id)
            .eq("project_id", projectId)
            .single();

        if (!namespace) {
            return NextResponse.json({ error: "Namespace not found" }, { status: 404 });
        }

        // Generate embedding using OpenAI
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
        const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: content,
        });
        const embedding = embeddingResponse.data[0].embedding;

        // Store the memory
        const { data: memory, error } = await adminClient
            .from("memories")
            .insert({
                namespace_id,
                content,
                metadata: metadata || {},
                embedding,
            })
            .select("id, content, metadata, created_at")
            .single();

        if (error) {
            console.error("Error storing memory:", error);
            return NextResponse.json({ error: "Failed to store memory" }, { status: 500 });
        }

        return NextResponse.json({ memory }, { status: 201 });

    } catch (error) {
        console.error("Error in memories POST:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
