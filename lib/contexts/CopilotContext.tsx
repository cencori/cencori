"use client";

import { createContext, useContext, type ComponentProps } from "react";
import type { CencoriAgentSidebar } from "@/components/dashboard/CencoriAgentSidebar";

type AgentProps = ComponentProps<typeof CencoriAgentSidebar>;

interface CopilotContextValue {
    open: boolean;
    setOpen: (open: boolean) => void;
    /** Where the full-screen Copilot page lives for this workspace, if anywhere. */
    fullPageHref: string | null;
    /** What the full-screen page needs to render the same Copilot as the panel. */
    agent: Pick<AgentProps, "project" | "organization" | "environment" | "userName">;
}

/**
 * Copilot's open state lives in the dashboard layout; this lets nested
 * navigation (the organization sidebar) open and close it too.
 */
export const CopilotContext = createContext<CopilotContextValue | null>(null);

export function useCopilot(): CopilotContextValue | null {
    return useContext(CopilotContext);
}
