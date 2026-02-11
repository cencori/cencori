import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabaseServer";
import { SharedChatUI } from "@/components/chat/SharedChatUI";
import { Metadata } from 'next';

interface ChatPageProps {
    params: Promise<{
        id: string;
    }>;
}

export async function generateMetadata({ params }: ChatPageProps): Promise<Metadata> {
    const { id } = await params;
    const supabase = await createServerClient();
    const { data: chat } = await supabase
        .from("shared_chats")
        .select("title")
        .eq("id", id)
        .single();

    return {
        title: chat?.title ? `${chat.title} | Cencori AI` : "Shared AI Conversation | Cencori",
        description: "Read this AI conversation shared via Cencori.",
    };
}

export default async function ChatPage({ params }: ChatPageProps) {
    const { id } = await params;
    const supabase = await createServerClient();
    const { data: chat, error } = await supabase
        .from("shared_chats")
        .select("content, title, created_at")
        .eq("id", id)
        .single();

    if (error || !chat) {
        notFound();
    }

    // Supabase returns JSONB as already parsed object/array
    const messages = chat.content;

    return (
        <SharedChatUI
            messages={messages as any[]}
            title={chat.title}
            createdAt={chat.created_at}
        />
    );
}
