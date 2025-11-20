import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { generateApiKey, hashApiKey, extractKeyPrefix, getKeyLastFour } from "@/lib/api-keys";

/**
 * GET /api/projects/[projectId]/api-keys
 * List all API keys for a project
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const supabase = await createServerClient();
        const { projectId } = await params;

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
        const orgOwner = (project.organizations as { owner_id?: string })?.owner_id;
        if (!orgOwner || orgOwner !== user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Fetch all non-revoked API keys for the project
        const { data: apiKeys, error: keysError } = await supabase
            .from("api_keys")
            .select("*")
            .eq("project_id", projectId)
            .is("revoked_at", null)
            .order("created_at", { ascending: false });

        if (keysError) {
            console.error("Error fetching API keys:", keysError);
            return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 });
        }

        // Return keys without the hash
        const sanitizedKeys = apiKeys.map(key => ({
            id: key.id,
            name: key.name,
            key_prefix: key.key_prefix,
            created_at: key.created_at,
            last_used_at: key.last_used_at,
        }));

        return NextResponse.json({ apiKeys: sanitizedKeys });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * POST /api/projects/[projectId]/api-keys
 * Generate a new API key
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const supabase = await createServerClient();
        const { projectId } = await params;
        const body = await request.json();
        const { name } = body;

        if (!name || typeof name !== "string" || name.trim().length === 0) {
            return NextResponse.json({ error: "Key name is required" }, { status: 400 });
        }

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
        const orgOwner = (project.organizations as { owner_id?: string })?.owner_id;
        if (!orgOwner || orgOwner !== user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Generate new API key
        const apiKey = generateApiKey();
        const keyHash = hashApiKey(apiKey);
        const keyPrefix = extractKeyPrefix(apiKey);

        // Store the hashed key in database
        const { data: newKey, error: insertError } = await supabase
            .from("api_keys")
            .insert({
                project_id: projectId,
                name: name.trim(),
                key_prefix: keyPrefix,
                key_hash: keyHash,
                created_by: user.id,
            })
            .select()
            .single();

        if (insertError) {
            console.error("Error creating API key:", insertError);
            return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
        }

        // Return the full key (only time it's shown) and metadata
        return NextResponse.json({
            apiKey: apiKey, // Full key - only shown once
            metadata: {
                id: newKey.id,
                name: newKey.name,
                key_prefix: newKey.key_prefix,
                created_at: newKey.created_at,
            },
        }, { status: 201 });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
