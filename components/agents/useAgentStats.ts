"use client";

import { useQuery } from "@tanstack/react-query";

export interface AgentStats {
    days: number;
    totals: {
        runs: number;
        failed: number;
        successRate: number | null;
        avgDurationMs: number | null;
        costUsd: number;
        tokens: number;
        customers: number;
    };
    daily: { date: string; runs: number; completed: number; failed: number; costUsd: number; tokens: number; avgDurationMs: number }[];
    truncated: boolean;
}

export function useAgentStats(projectId: string, agentId: string, days: string) {
    return useQuery({
        queryKey: ["agentStats", projectId, agentId, days],
        queryFn: async (): Promise<AgentStats> => {
            const response = await fetch(`/api/projects/${projectId}/embedded-agents/${encodeURIComponent(agentId)}/stats?days=${days}`);
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.error || "We could not load this agent's activity.");
            }
            return response.json();
        },
        staleTime: 30_000,
        placeholderData: (previous) => previous,
    });
}

export interface AgentRun {
    id: string;
    agent_id: string;
    tenant_id: string | null;
    status: string;
    error: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    /** An API run, or one conversation turn (widget, share link, Sessions API). */
    kind?: "api" | "conversation";
}

/** A page of one agent's runs, newest first. */
export function useAgentRuns(projectId: string, agentId: string, options: { limit: number; offset?: number; status?: string }) {
    const { limit, offset = 0, status = "all" } = options;
    return useQuery({
        queryKey: ["agentRuns", projectId, agentId, limit, offset, status],
        queryFn: async (): Promise<{ runs: AgentRun[] }> => {
            const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
            if (status !== "all") params.set("status", status);
            const response = await fetch(`/api/projects/${projectId}/embedded-agents/${encodeURIComponent(agentId)}/runs?${params}`);
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.error || "We could not load this agent's runs.");
            }
            return response.json();
        },
        staleTime: 15_000,
        placeholderData: (previous) => previous,
    });
}
