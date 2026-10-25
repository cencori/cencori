"use client";

import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

/*
 * Shared data for the Agents section. Every agents page reads the same studio
 * payload (one request per project), so switching between an agent's sections
 * never refetches or loses unsaved edits.
 */

export type Agent = { id: string; name: string; description: string | null; is_active: boolean; stable_version_id: string | null; created_at: string };
export type Version = { id: string; agent_id: string; version: string; status: string; visibility?: string | null; config_json: { model?: string; instructions?: string; system_prompt?: string; [key: string]: unknown }; last_tested_at: string | null; last_test_passed: boolean; published_at: string | null; created_at: string };
export type Tenant = { id: string; name: string; external_id: string; status: string };
export type Installation = { id: string; agent_id: string; tenant_id: string; agent_version_id: string | null; status: string };
export type Run = { id: string; agent_id: string; tenant_id: string | null; status: string; error: string | null; created_at: string };
export type Model = { id: string; name: string; provider: string };
export type Workspace = { can_manage: boolean; studio_ready: boolean; agents: Agent[]; versions: Version[]; tenants: Tenant[]; installations: Installation[]; runs: Run[]; models: Model[] };
export type AgentForm = { name: string; description: string; model: string; instructions: string };

export const emptyAgentForm: AgentForm = { name: "", description: "", model: "", instructions: "" };

export const studioQueryKey = (projectId: string | undefined) => ["embedded-agent-studio", projectId];

export function useAgentStudio(projectId: string | undefined) {
    return useQuery<Workspace>({
        queryKey: studioQueryKey(projectId),
        enabled: !!projectId,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        queryFn: async () => {
            const response = await fetch(`/api/projects/${projectId}/embedded-agents/studio`);
            if (!response.ok) {
                const payload = await response.json().catch(() => ({})) as { error?: string };
                throw new Error(payload.error || "We couldn't load your agent workspace.");
            }
            return response.json() as Promise<Workspace>;
        },
    });
}

/** POST an action to the studio endpoint; throws with the server's message. */
export async function postStudioAction(projectId: string, action: string, payload: Record<string, unknown> = {}) {
    const response = await fetch(`/api/projects/${projectId}/embedded-agents/studio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
    });
    const result = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "That didn't work. Try again.");
    return result;
}

/** `/acme/app/agents/abc/runs` → `/acme/app/agents`; console hosts give `/agents`. */
export function useAgentsBasePath(): string {
    const pathname = usePathname() ?? "";
    const index = pathname.indexOf("/agents");
    return index === -1 ? "/agents" : pathname.slice(0, index + "/agents".length);
}

/** The agent id in the current path, if on one agent's pages. */
export function agentIdFromPath(pathname: string): string | null {
    const match = pathname.match(/\/agents\/([^/?#]+)/);
    return match && match[1] !== "new" ? decodeURIComponent(match[1]) : null;
}

const LOCKED_STATUSES = ["published", "deprecated", "retired"];

export function isLockedVersion(version: Version | null | undefined) {
    return !!version && LOCKED_STATUSES.includes(version.status);
}

/** The draft to edit if there is one, otherwise the newest version. */
export function workingVersion(versions: Version[]) {
    return versions.find((version) => !isLockedVersion(version)) ?? versions[0] ?? null;
}

export function agentStatus(agent: Agent) {
    return !agent.is_active ? "Inactive" : agent.stable_version_id ? "Published" : "Draft";
}

export function statusTone(status: string) {
    const normalized = status.toLowerCase();
    if (normalized === "published" || normalized === "completed" || normalized === "active") {
        return { text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" };
    }
    if (normalized === "draft" || normalized === "running" || normalized === "queued") {
        return { text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" };
    }
    if (normalized === "failed" || normalized === "cancelled") {
        return { text: "text-destructive", dot: "bg-destructive" };
    }
    return { text: "text-muted-foreground", dot: "bg-muted-foreground" };
}

export function Status({ status }: { status: string }) {
    const tone = statusTone(status);
    return (
        <span className={`inline-flex items-center gap-1.5 text-xs capitalize ${tone.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            {status.replaceAll("_", " ")}
        </span>
    );
}

/** Advanced versions (tools, skills, policies…) can only be edited through the API. */
export function isSimpleVersion(version: Version | null | undefined) {
    const config = version?.config_json;
    if (!config) return false;
    const policy = config.policy as { browser?: { enabled?: boolean }; network?: { mode?: string }; require_approval?: unknown[] } | undefined;
    return !["skills", "tools", "connection_requirements", "mcp_tools", "subagents", "knowledge_refs"].some((key) => Array.isArray(config[key]) && (config[key] as unknown[]).length > 0)
        && !policy?.browser?.enabled && policy?.network?.mode !== "allowlist" && !policy?.require_approval?.length
        && !config.input_schema && !config.output_schema && !config.response_format && !config.fallback_policy;
}
