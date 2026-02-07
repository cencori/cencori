import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabaseServer";
import OpenAI from "openai";

/**
 * Dashboard API: Semantic search in a namespace
 */

const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RouteParams = { params: Promise<{ projectId: string }> };

// GET: Search memories semantically
export async function GET(request: NextRequest, context: RouteParams) {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { projectId } = await context.params;
        const { searchParams } = new URL(request.url);
        const namespaceName = searchParams.get("namespace");
        const query = searchParams.get("query");
        const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

        if (!namespaceName || !query) {
            return NextResponse.json({ error: "namespace and query params required" }, { status: 400 });
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

        // Get namespace ID
        const { data: namespace } = await adminClient
            .from("memory_namespaces")
            .select("id")
            .eq("name", namespaceName)
            .eq("project_id", projectId)
            .single();

        if (!namespace) {
            return NextResponse.json({ error: "Namespace not found" }, { status: 404 });
        }

        // Get project's OpenAI key for embeddings
        const { data: providerKey } = await adminClient
            .from("project_provider_keys")
            .select("encrypted_key")
            .eq("project_id", projectId)
            .eq("provider", "openai")
            .single();

        // Use project key or fallback to platform key
        const openaiKey = providerKey?.encrypted_key || process.env.OPENAI_API_KEY;

        if (!openaiKey) {
            return NextResponse.json({ error: "No OpenAI API key configured" }, { status: 400 });
        }

        const openai = new OpenAI({ apiKey: openaiKey });

        // Generate embedding for query
        const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: query,
        });
        const queryEmbedding = embeddingResponse.data[0].embedding;

        // Search using pgvector
        const { data: results, error } = await adminClient.rpc("match_memories", {
            query_embedding: queryEmbedding,
            p_namespace_id: namespace.id,
            match_threshold: 0.5,
            match_count: limit,
        });

        if (error) {
            console.error("Error searching memories:", error);
            return NextResponse.json({ error: "Search failed" }, { status: 500 });
        }

        return NextResponse.json({ results: results || [] });
    } catch (error) {
        console.error("Error in memory search:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
