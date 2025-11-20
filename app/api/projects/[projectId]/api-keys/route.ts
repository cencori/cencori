import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import crypto from "crypto";

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

        // Get environment from query params, default to production
        const { searchParams } = new URL(request.url);
        const environment = searchParams.get("environment") || "production";

        // Fetch API keys for the project and environment
        const { data: apiKeys, error: keysError } = await supabase
            .from("api_keys")
            .select("*")
            .eq("project_id", projectId)
            .eq("environment", environment)
            .is("revoked_at", null)
            .order("created_at", { ascending: false });

        if (keysError) {
            console.error("Error fetching API keys:", keysError);
            return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 });
        }

        return NextResponse.json({ apiKeys });
    } catch (error) {
        console.error("Error in GET /api/projects/[projectId]/api-keys:", error);
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
        const { projectId } = await params;
        const supabase = await createServerClient();

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Parse body
        const body = await request.json();
        const { name, environment = "production" } = body;

        if (!name || typeof name !== "string" || name.trim().length === 0) {
            return NextResponse.json({ error: "Key name is required" }, { status: 400 });
        }

        // Verify project ownership
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
            return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
        }

        // Check if user is the owner
        const ownerId = (project.organizations as { owner_id?: string })?.owner_id;

        if (ownerId !== user.id) {
            return NextResponse.json({ error: "Only organization owners can create API keys" }, { status: 403 });
        }

        // Generate API key
        // Format: cen_[test_]randomString
        const prefix = environment === "test" ? "cen_test_" : "cen_";
        const randomBytes = crypto.randomBytes(24);
        const keyString = randomBytes.toString("hex"); // 48 chars
        const apiKey = `${prefix}${keyString}`;

        // Hash the key for storage
        const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

        // Store in database
        const { data: newKey, error: createError } = await supabase
            .from("api_keys")
            .insert({
                project_id: projectId,
                name: name.trim(),
                key_prefix: apiKey.substring(0, environment === "test" ? 13 : 8) + "...",
                key_hash: keyHash,
                created_by: user.id,
                environment
            })
            .select()
            .single();

        if (createError) {
            console.error("Error creating API key:", createError);
            return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
        }

        // Return the full key only once
        return NextResponse.json({
            apiKey: {
                ...newKey,
                full_key: apiKey // This is the only time the full key is returned
            }
        }, { status: 201 });
    } catch (error) {
        console.error("Error in POST /api/projects/[projectId]/api-keys:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
