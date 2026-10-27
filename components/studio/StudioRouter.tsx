"use client";

import StudioHomePage from "@/components/studio/views/HomeView";
import StudioInboxPage from "@/components/studio/views/InboxView";
import StudioConversationPage from "@/components/studio/views/ConversationView";
import StudioSalesPage from "@/components/studio/views/SalesView";
import StudioMoneyPage from "@/components/studio/views/MoneyView";
import StudioAssistantPage from "@/components/studio/views/AssistantView";
import StudioAssistantDetailPage from "@/components/studio/views/AssistantDetailView";
import { StudioLink, useStudioPath } from "@/components/studio/studio-nav";

/** The screen for the current address (studio-nav.tsx explains how they switch). */
export function StudioRouter() {
    const path = useStudioPath();
    const conversation = /^\/inbox\/([^/]+)$/.exec(path);
    if (conversation) return <StudioConversationPage key={conversation[1]} id={decodeURIComponent(conversation[1])} />;
    const assistant = /^\/assistant\/([^/]+)$/.exec(path);
    if (assistant) return <StudioAssistantDetailPage key={assistant[1]} id={decodeURIComponent(assistant[1])} />;
    if (path === "/inbox") return <StudioInboxPage />;
    if (path === "/sales") return <StudioSalesPage />;
    if (path === "/money") return <StudioMoneyPage />;
    if (path === "/assistant") return <StudioAssistantPage />;
    if (path === "/") return <StudioHomePage />;
    return (
        <div className="mt-10 text-center">
            <p className="text-lg font-semibold">This page isn&apos;t here</p>
            <StudioLink href="/" className="mt-4 inline-flex h-11 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background">Go to Home</StudioLink>
        </div>
    );
}
