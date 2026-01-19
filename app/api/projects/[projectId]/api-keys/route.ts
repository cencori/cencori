import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import crypto from "crypto";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const supabase = await createServerClient();
        const { projectId } = await params;

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
        const { searchParams } = new URL(request.url);
        const environment = searchParams.get("environment") || "production";

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

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await params;
        const supabase = await createServerClient();

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const {
            name,
            environment = "production",
            key_type = "secret",
            allowed_domains = null
        } = body;

        if (!name || typeof name !== "string" || name.trim().length === 0) {
            return NextResponse.json({ error: "Key name is required" }, { status: 400 });
        }

        if (!['secret', 'publishable'].includes(key_type)) {
            return NextResponse.json({ error: "Invalid key_type. Must be 'secret' or 'publishable'" }, { status: 400 });
        }
        if (key_type === 'publishable') {
            if (!allowed_domains || !Array.isArray(allowed_domains) || allowed_domains.length === 0) {
                return NextResponse.json({
                    error: "Publishable keys require at least one allowed domain"
                }, { status: 400 });
            }
            for (const domain of allowed_domains) {
                if (typeof domain !== 'string' || domain.trim().length === 0) {
                    return NextResponse.json({ error: "Invalid domain format" }, { status: 400 });
                }
            }
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
            return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
        }

        const ownerId = (project.organizations as { owner_id?: string })?.owner_id;

        if (ownerId !== user.id) {
            return NextResponse.json({ error: "Only organization owners can create API keys" }, { status: 403 });
        }

        const typePrefix = key_type === 'publishable' ? 'cpk' : 'csk';
        const envSuffix = environment === "test" ? "_test" : "";
        const prefix = `${typePrefix}${envSuffix}_`;

        const randomBytes = crypto.randomBytes(24);
        const keyString = randomBytes.toString("hex");
        const apiKey = `${prefix}${keyString}`;

        const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

        const prefixDisplayLength = prefix.length + 4;

        const { data: newKey, error: createError } = await supabase
            .from("api_keys")
            .insert({
                project_id: projectId,
                name: name.trim(),
                key_prefix: apiKey.substring(0, prefixDisplayLength) + "...",
                key_hash: keyHash,
                created_by: user.id,
                environment,
                key_type,
                allowed_domains: key_type === 'publishable' ? allowed_domains : null
            })
            .select()
            .single();

        if (createError) {
            console.error("Error creating API key:", createError);
            return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
        }

        return NextResponse.json({
            apiKey: {
                ...newKey,
                full_key: apiKey
            }
        }, { status: 201 });
    } catch (error) {
        console.error("Error in POST /api/projects/[projectId]/api-keys:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
