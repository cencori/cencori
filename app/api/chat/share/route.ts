import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { messages } = body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json({ error: "Invalid messages" }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceRoleKey) {
            console.error("Share API misconfigured: missing Supabase env (URL or SERVICE_ROLE_KEY).");
            return NextResponse.json(
                { error: "Sharing is temporarily unavailable (server misconfigured)." },
                { status: 500 },
            );
        }

        // 1. Try to identify the user for attribution (optional)
        let userId: string | null = null;
        try {
            const supabase = await createServerClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) userId = user.id;
        } catch (err) {
            console.warn("Failed to get user session:", err);
            // Continue as anonymous
        }

        // 2. Use Service Role for insertion (Bypass RLS for robust public sharing)
        const adminAuthClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        // Sanitize: keep only role/content, cap size to prevent abuse/oversized rows.
        const cleanMessages = messages
            .filter(
                (m: any) =>
                    m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
            )
            .slice(0, 200)
            .map((m: any) => ({ role: m.role, content: m.content.slice(0, 20_000) }));

        if (cleanMessages.length === 0) {
            return NextResponse.json({ error: "Invalid messages" }, { status: 400 });
        }

        // Derive a title
        const firstUserMessage = cleanMessages.find((m: any) => m.role === "user");
        let title = "AI Conversation";
        if (firstUserMessage && firstUserMessage.content) {
            title = firstUserMessage.content.slice(0, 50);
            if (firstUserMessage.content.length > 50) title += "...";
        }

        const { data, error } = await adminAuthClient
            .from("shared_chats")
            .insert({
                content: cleanMessages,
                title: title,
                user_id: userId,
            })
            .select("id")
            .single();

        if (error) {
            console.error("Error inserting shared chat:", error);
            // Return actual error in dev/debug, generic in prod usually, but beneficial for user now
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Prefer explicit site URL in prod (req.url origin can be a preview/internal host).
        const siteUrl =
            process.env.NEXT_PUBLIC_SITE_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            new URL(req.url).origin;
        const url = `${siteUrl.replace(/\/$/, "")}/chat/${data.id}`;

        return NextResponse.json({ id: data.id, url });
    } catch (error) {
        console.error("Error in share API:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
    }
}
