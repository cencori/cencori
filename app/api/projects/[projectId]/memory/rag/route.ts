import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

interface RouteParams {
    params: Promise<{ projectId: string }>;
}

// Admin client for DB operations
const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper to get authenticated user
async function getAuthUser() {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

interface Memory {
    id: string;
    content: string;
    metadata: Record<string, unknown>;
    similarity: number;
}

// POST: RAG - Chat with memory context
export async function POST(request: NextRequest, context: RouteParams) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { projectId } = await context.params;
        const body = await request.json();
        const { namespace, message, model = "gemini-2.0-flash", limit = 5 } = body;

        if (!namespace || !message) {
            return NextResponse.json({ error: "namespace and message are required" }, { status: 400 });
        }

        // Verify user has access to project
        const { data: project, error: projectError } = await adminClient
            .from("projects")
            .select("id, organization_id")
            .eq("id", projectId)
            .single();

        if (projectError || !project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        // Check user is member of organization
        const { data: member } = await adminClient
            .from("organization_members")
            .select("role")
            .eq("organization_id", project.organization_id)
            .eq("user_id", user.id)
            .single();

        if (!member) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        // Get namespace
        const { data: namespaceData } = await adminClient
            .from("memory_namespaces")
            .select("id")
            .eq("project_id", projectId)
            .eq("name", namespace)
            .single();

        if (!namespaceData) {
            return NextResponse.json({ error: "Namespace not found" }, { status: 404 });
        }

        // Generate embedding for the query
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
        const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: message,
        });
        const queryEmbedding = embeddingResponse.data[0].embedding;

        // Search for relevant memories
        const { data: memories, error: searchError } = await adminClient.rpc("search_memories", {
            query_embedding: queryEmbedding,
            match_threshold: 0.5,
            match_count: limit,
            p_namespace_id: namespaceData.id,
        });

        if (searchError) {
            console.error("[RAG] Search error:", searchError);
        }

        const retrievedMemories: Memory[] = (memories || []).map((m: { id: string; content: string; metadata: Record<string, unknown>; similarity: number }) => ({
            id: m.id,
            content: m.content,
            metadata: m.metadata,
            similarity: m.similarity,
        }));

        // Build context block
        let contextBlock = "";
        if (retrievedMemories.length > 0) {
            contextBlock = `\n\n## Relevant Context\nThe following information was retrieved from memory:\n\n`;
            retrievedMemories.forEach((mem, i) => {
                contextBlock += `[${i + 1}] ${mem.content}\n`;
            });
            contextBlock += "\nUse the above context to inform your response.\n";
        }

        // Build messages for LLM
        const systemPrompt = `You are a helpful AI assistant with access to stored knowledge.${contextBlock}`;

        // Call LLM (using OpenAI for simplicity - the main chat API handles provider routing)
        const completion = await openai.chat.completions.create({
            model: model.includes("gpt") ? model : "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: message }
            ],
            max_tokens: 1000,
        });

        const responseText = completion.choices[0]?.message?.content || "No response generated.";

        return NextResponse.json({
            response: responseText,
            sources: retrievedMemories.map(m => ({
                content: m.content,
                similarity: m.similarity,
            })),
            model: completion.model,
        });

    } catch (error) {
        console.error("[RAG] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
