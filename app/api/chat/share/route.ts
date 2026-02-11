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
        const adminAuthClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            }
        );

        // Derive a title
        const firstUserMessage = messages.find((m: any) => m.role === "user");
        let title = "AI Conversation";
        if (firstUserMessage && firstUserMessage.content) {
            title = firstUserMessage.content.slice(0, 50);
            if (firstUserMessage.content.length > 50) title += "...";
        }

        const { data, error } = await adminAuthClient
            .from("shared_chats")
            .insert({
                content: messages,
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

        const url = `${new URL(req.url).origin}/chat/${data.id}`;

        return NextResponse.json({ id: data.id, url });
    } catch (error) {
        console.error("Error in share API:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
    }
}
