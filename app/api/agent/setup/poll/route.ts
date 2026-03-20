import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

// GET /api/agent/setup/poll?token=xxx
// The install script polls this to check if the user completed browser-based setup
export async function GET(req: NextRequest) {
    const token = req.nextUrl.searchParams.get("token");

    if (!token || token.length < 8) {
        return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: setup } = await supabase
        .from("agent_setup_tokens")
        .select("*")
        .eq("token", token)
        .single();

    if (!setup) {
        return NextResponse.json({ status: "waiting" });
    }

    if (setup.status === "ready" && setup.api_key) {
        // Clean up the token after successful retrieval
        await supabase
            .from("agent_setup_tokens")
            .delete()
            .eq("token", token);

        return NextResponse.json({
            status: "ready",
            api_key: setup.api_key,
            agent_id: setup.agent_id,
            agent_name: setup.agent_name,
            project_name: setup.project_name,
        });
    }

    return NextResponse.json({ status: "waiting" });
}

// POST /api/agent/setup/poll
// Called by the dashboard when user completes agent setup via browser
export async function POST(req: NextRequest) {
    const body = await req.json();
    const { token, api_key, agent_id, agent_name, project_name } = body;

    if (!token || !api_key) {
        return NextResponse.json({ error: "Missing token or api_key" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Upsert the token with the setup result
    const { error } = await supabase
        .from("agent_setup_tokens")
        .upsert({
            token,
            status: "ready",
            api_key,
            agent_id: agent_id || null,
            agent_name: agent_name || "Agent",
            project_name: project_name || null,
            created_at: new Date().toISOString(),
        }, { onConflict: "token" });

    if (error) {
        return NextResponse.json({ error: "Failed to save setup" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
