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

// Chunk text into smaller pieces
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 100): string[] {
    const chunks: string[] = [];
    let start = 0;

    // Clean the text
    text = text.replace(/\s+/g, ' ').trim();

    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        let chunk = text.slice(start, end);

        // Try to break at sentence boundary
        if (end < text.length) {
            const lastPeriod = chunk.lastIndexOf('.');
            const lastQuestion = chunk.lastIndexOf('?');
            const lastExclaim = chunk.lastIndexOf('!');
            const lastBreak = Math.max(lastPeriod, lastQuestion, lastExclaim);

            if (lastBreak > chunkSize * 0.5) {
                chunk = chunk.slice(0, lastBreak + 1);
            }
        }

        chunks.push(chunk.trim());
        start = start + chunk.length - overlap;

        // Prevent infinite loop
        if (start <= 0 && chunks.length > 1) break;
        if (chunks.length > 100) break; // Max 100 chunks per document
    }

    return chunks.filter(c => c.length > 10);
}

// POST: Upload and process a document
export async function POST(request: NextRequest, context: RouteParams) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { projectId } = await context.params;
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const namespaceId = formData.get("namespace_id") as string | null;

        if (!file) {
            return NextResponse.json({ error: "File is required" }, { status: 400 });
        }

        if (!namespaceId) {
            return NextResponse.json({ error: "Namespace ID is required" }, { status: 400 });
        }

        // Check file type
        const allowedTypes = ["text/plain", "application/pdf", "text/markdown"];
        if (!allowedTypes.includes(file.type) && !file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
            return NextResponse.json({ error: "Only TXT, MD, and PDF files are supported" }, { status: 400 });
        }

        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 });
        }

        // Verify user has access to project
        const { data: project } = await adminClient
            .from("projects")
            .select("id, organization_id")
            .eq("id", projectId)
            .single();

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        // Check user is member of organization
        const { data: membership } = await adminClient
            .from("organization_members")
            .select("id")
            .eq("organization_id", project.organization_id)
            .eq("user_id", user.id)
            .single();

        if (!membership) {
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

        // Extract text from file
        let text: string;
        if (file.type === "application/pdf") {
            // For PDF, we'll just read as text (basic support)
            // In production, you'd use pdf-parse or similar
            const buffer = await file.arrayBuffer();
            text = new TextDecoder().decode(buffer);
            // Try to clean up PDF text
            text = text.replace(/[^\x20-\x7E\n]/g, ' ');
        } else {
            text = await file.text();
        }

        if (!text.trim()) {
            return NextResponse.json({ error: "File appears to be empty" }, { status: 400 });
        }

        // Chunk the document
        const chunks = chunkText(text);

        if (chunks.length === 0) {
            return NextResponse.json({ error: "Could not extract text from file" }, { status: 400 });
        }

        // Generate embeddings for all chunks
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

        const memories: Array<{
            namespace_id: string;
            content: string;
            metadata: object;
            embedding: number[];
        }> = [];

        // Process chunks in batches of 10
        for (let i = 0; i < chunks.length; i += 10) {
            const batch = chunks.slice(i, i + 10);
            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: batch,
            });

            for (let j = 0; j < batch.length; j++) {
                memories.push({
                    namespace_id: namespaceId,
                    content: batch[j],
                    metadata: {
                        source: file.name,
                        chunk_index: i + j,
                        total_chunks: chunks.length,
                    },
                    embedding: embeddingResponse.data[j].embedding,
                });
            }
        }

        // Store all memories
        const { error } = await adminClient
            .from("memories")
            .insert(memories);

        if (error) {
            console.error("Error storing memories:", error);
            return NextResponse.json({ error: "Failed to store memories" }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            file_name: file.name,
            chunks_created: chunks.length,
            message: `Successfully created ${chunks.length} memories from "${file.name}"`,
        }, { status: 201 });

    } catch (error) {
        console.error("Error in document upload:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
