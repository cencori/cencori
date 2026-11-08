"use client";

import { useDocsContext } from "./DocsContext";
import { AskAISidebar } from "./AskAISidebar";

export function DocsSidebarWrapper() {
    const { isAskAIOpen, setAskAIOpen } = useDocsContext();

    return (
        <AskAISidebar
            open={isAskAIOpen}
            onClose={() => setAskAIOpen(false)}
        />
    );
}
