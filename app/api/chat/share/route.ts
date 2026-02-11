import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { messages } = body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json({ error: "Invalid messages" }, { status: 400 });
        }

        const supabase = await createServerClient();

        // Try to get current user, but don't require it (handled by RLS policies if we allow anon)
        // But our RLS "Users can insert their own chats" requires auth.uid() = user_id
        // And "Anyone can insert chats" is what I added.
        // Let's get the user ID if available.
        const { data: { user } } = await supabase.auth.getUser();

        // Derive a title
        const firstUserMessage = messages.find((m: any) => m.role === "user");
        let title = "AI Conversation";
        if (firstUserMessage && firstUserMessage.content) {
            title = firstUserMessage.content.slice(0, 50);
            if (firstUserMessage.content.length > 50) title += "...";
        }

        const { data, error } = await supabase
            .from("shared_chats")
            .insert({
                content: messages,
                title: title,
                user_id: user?.id || null,
                // formatted content or raw? raw JSON is fine.
            })
            .select("id")
            .single();

        if (error) {
            console.error("Error inserting shared chat:", error);
            return NextResponse.json({ error: "Failed to save chat" }, { status: 500 });
        }

        const url = `${new URL(req.url).origin}/chat/${data.id}`;

        return NextResponse.json({ id: data.id, url });
    } catch (error) {
        console.error("Error in share API:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
