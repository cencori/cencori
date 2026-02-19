"use server";

import { createServerClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import crypto from 'crypto';
import { decryptApiKey, encryptApiKey } from "@/lib/encryption";
import { redirect } from "next/navigation";

/**
 * Generate a new API Key for the agent.
 * Revokes any existing keys for this agent before creating a new one.
 */
export async function generateAgentKey(agentId: string, projectId: string) {
    const supabase = await createServerClient();

    // 1. Revoke old keys for this agent
    await supabase
        .from('api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('project_id', projectId)
        .like('name', `Agent ${agentId} Key%`);

    // 2. Generate new key
    const rawKey = `cake_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const { error } = await supabase.from('api_keys').insert({
        project_id: projectId,
        key_hash: keyHash,
        key_prefix: 'cake_',
        name: `Agent ${agentId} Key`
    });

    if (error) {
        console.error("Error generating key:", error);
        throw new Error("Failed to generate key");
    }

    revalidatePath(`/dashboard`);
    return rawKey;
}

/**
 * Update Agent Configuration
 */
export async function updateAgentConfig(agentId: string, path: string, data: {
    model?: string;
    system_prompt?: string;
    temperature?: number;
    is_active?: boolean;
    shadow_mode?: boolean;
}) {
    const supabase = await createServerClient();

    // 1. Update Agent Table (Active/Shadow)
    if (data.is_active !== undefined || data.shadow_mode !== undefined) {
        const { error: agentError } = await supabase
            .from('agents')
            .update({
                is_active: data.is_active,
                shadow_mode: data.shadow_mode
            })
            .eq('id', agentId);

        if (agentError) throw new Error("Failed to update agent status");
    }

    // 2. Update Config Table (Model/Prompt)
    if (data.model || data.system_prompt || data.temperature !== undefined) {
        // Upsert because config might not verify exist if created manually
        const { error: configError } = await supabase
            .from('agent_configs')
            .upsert({
                agent_id: agentId,
                model: data.model,
                system_prompt: data.system_prompt,
                ...(data.temperature !== undefined && { temperature: data.temperature })
            }, { onConflict: 'agent_id' });

        if (configError) {
            console.error("Failed to update agent config:", configError);
            throw new Error("Failed to update config");
        }
    }

    revalidatePath(path);
}

/**
 * Rename Agent
 */
export async function updateAgentName(agentId: string, path: string, name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) {
        throw new Error("Agent name cannot be empty");
    }

    const supabase = await createServerClient();
    const { error } = await supabase
        .from("agents")
        .update({ name: trimmedName })
        .eq("id", agentId);

    if (error) {
        console.error("Failed to update agent name:", error);
        throw new Error("Failed to update agent name");
    }

    revalidatePath(path);
}

type TelemetryPoint = {
    ts: string;
    reqPerSec: number;
    p95LatencyMs: number;
    errorRatePct: number;
    tokensPerMin: number;
    costUsd: number;
};

export type AgentTelemetry = {
    reqPerSec: number;
    p95LatencyMs: number;
    errorRatePct: number;
    tokensPerMin: number;
    costTodayUsd: number;
    points: TelemetryPoint[];
    apiKeyIds: string[];
};

export type AgentN8nConnection = {
    baseUrl: string;
    workspaceId: string | null;
    connectionStatus: "connected" | "error" | "disconnected";
    lastTestedAt: string | null;
    lastError: string | null;
    hasApiKey: boolean;
    starterWorkflowId: string | null;
    starterWorkflowUrl: string | null;
    starterTemplateVersion: string | null;
    starterInstalledAt: string | null;
    workflowActive: boolean;
    lastExecutionAt: string | null;
    lastExecutionStatus: string | null;
    executionSuccessRate: number | null;
    executionAvgDurationMs: number | null;
};

const STARTER_TEMPLATE_VERSION = "v1";

function getStarterWorkflowName(agentId: string): string {
    return `Cencori Starter (${agentId}) [${STARTER_TEMPLATE_VERSION}]`;
}

function normalizeN8nBaseUrl(baseUrl: string): string {
    return baseUrl.trim().replace(/\/+$/, "");
}

async function getAgentOrganizationId(
    supabase: Awaited<ReturnType<typeof createServerClient>>,
    agentId: string
): Promise<string> {
    const { data: agent, error: agentError } = await supabase
        .from("agents")
        .select("project_id")
        .eq("id", agentId)
        .single();

    if (agentError || !agent) {
        throw new Error("Agent not found");
    }

    const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("organization_id")
        .eq("id", agent.project_id)
        .single();

    if (projectError || !project) {
        throw new Error("Project not found");
    }

    return project.organization_id as string;
}

async function n8nRequest<T>(
    baseUrl: string,
    apiKey: string,
    path: string,
    init?: RequestInit
): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
            "X-N8N-API-KEY": apiKey,
            "Accept": "application/json",
            ...(init?.headers || {}),
        },
        signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
        const body = (await response.text()).slice(0, 300);
        throw new Error(`n8n returned HTTP ${response.status}${body ? `: ${body}` : ""}`);
    }

    return response.json() as Promise<T>;
}

export async function getN8nConnection(agentId: string): Promise<AgentN8nConnection | null> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from("agent_n8n_connections")
        .select("base_url, workspace_id, connection_status, last_tested_at, last_error, api_key_encrypted, starter_workflow_id, starter_workflow_url, starter_template_version, starter_installed_at, starter_workflow_active, last_execution_at, last_execution_status, execution_success_rate, execution_avg_duration_ms")
        .eq("agent_id", agentId)
        .maybeSingle();

    if (error) {
        console.error("Failed to fetch n8n connection:", error);
        throw new Error("Failed to fetch n8n connection");
    }

    if (!data) return null;

    return {
        baseUrl: data.base_url,
        workspaceId: data.workspace_id,
        connectionStatus: (data.connection_status || "disconnected") as AgentN8nConnection["connectionStatus"],
        lastTestedAt: data.last_tested_at,
        lastError: data.last_error,
        hasApiKey: Boolean(data.api_key_encrypted),
        starterWorkflowId: data.starter_workflow_id,
        starterWorkflowUrl: data.starter_workflow_url,
        starterTemplateVersion: data.starter_template_version,
        starterInstalledAt: data.starter_installed_at,
        workflowActive: Boolean(data.starter_workflow_active),
        lastExecutionAt: data.last_execution_at,
        lastExecutionStatus: data.last_execution_status,
        executionSuccessRate: data.execution_success_rate !== null && data.execution_success_rate !== undefined
            ? Number(data.execution_success_rate)
            : null,
        executionAvgDurationMs: data.execution_avg_duration_ms,
    };
}

export async function saveN8nConnection(input: {
    agentId: string;
    path: string;
    baseUrl: string;
    apiKey?: string;
    workspaceId?: string;
}) {
    const supabase = await createServerClient();
    const baseUrl = normalizeN8nBaseUrl(input.baseUrl);

    if (!/^https?:\/\//i.test(baseUrl)) {
        throw new Error("n8n base URL must start with http:// or https://");
    }

    const organizationId = await getAgentOrganizationId(supabase, input.agentId);

    const { data: existing } = await supabase
        .from("agent_n8n_connections")
        .select("api_key_encrypted")
        .eq("agent_id", input.agentId)
        .maybeSingle();

    const trimmedKey = input.apiKey?.trim();
    const apiKeyEncrypted = trimmedKey
        ? encryptApiKey(trimmedKey, organizationId)
        : existing?.api_key_encrypted;

    if (!apiKeyEncrypted) {
        throw new Error("n8n API key is required for first-time connection");
    }

    const payload: {
        agent_id: string;
        base_url: string;
        api_key_encrypted: string;
        workspace_id: string | null;
        connection_status?: string;
        created_by?: string | null;
    } = {
        agent_id: input.agentId,
        base_url: baseUrl,
        api_key_encrypted: apiKeyEncrypted,
        workspace_id: input.workspaceId?.trim() || null,
    };

    if (!existing) {
        const { data: auth } = await supabase.auth.getUser();
        payload.connection_status = "disconnected";
        payload.created_by = auth.user?.id || null;
    }

    const { error } = await supabase
        .from("agent_n8n_connections")
        .upsert(payload, { onConflict: "agent_id" });

    if (error) {
        console.error("Failed to save n8n connection:", error);
        throw new Error("Failed to save n8n connection");
    }

    revalidatePath(input.path);
}

export async function testN8nConnection(agentId: string, path: string) {
    const supabase = await createServerClient();

    const { data: conn, error: connError } = await supabase
        .from("agent_n8n_connections")
        .select("base_url, api_key_encrypted")
        .eq("agent_id", agentId)
        .maybeSingle();

    if (connError || !conn) {
        throw new Error("n8n connection not configured");
    }

    const organizationId = await getAgentOrganizationId(supabase, agentId);
    const apiKey = decryptApiKey(conn.api_key_encrypted, organizationId);
    const baseUrl = normalizeN8nBaseUrl(conn.base_url);

    try {
        await n8nRequest(baseUrl, apiKey, "/api/v1/workflows?limit=1");

        await supabase
            .from("agent_n8n_connections")
            .update({
                connection_status: "connected",
                last_error: null,
                last_tested_at: new Date().toISOString(),
            })
            .eq("agent_id", agentId);

        revalidatePath(path);
        return { success: true, message: "Connected to n8n API successfully." };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown connection error";
        await supabase
            .from("agent_n8n_connections")
            .update({
                connection_status: "error",
                last_error: message,
                last_tested_at: new Date().toISOString(),
            })
            .eq("agent_id", agentId);

        revalidatePath(path);
        return { success: false, message };
    }
}

export async function disconnectN8nConnection(agentId: string, path: string) {
    const supabase = await createServerClient();
    const { error } = await supabase
        .from("agent_n8n_connections")
        .delete()
        .eq("agent_id", agentId);

    if (error) {
        console.error("Failed to disconnect n8n:", error);
        throw new Error("Failed to disconnect n8n");
    }

    revalidatePath(path);
}

function buildStarterN8nWorkflow(agentId: string, model: string) {
    return {
        name: getStarterWorkflowName(agentId),
        nodes: [
            {
                id: "Webhook_1",
                name: "Webhook",
                type: "n8n-nodes-base.webhook",
                typeVersion: 1,
                position: [260, 300],
                parameters: {
                    path: `cencori-starter-${agentId.slice(0, 8)}`,
                    httpMethod: "POST",
                    responseMode: "responseNode",
                },
            },
            {
                id: "Cencori_Request_1",
                name: "Cencori Chat Completion",
                type: "n8n-nodes-base.httpRequest",
                typeVersion: 4,
                position: [560, 300],
                parameters: {
                    method: "POST",
                    url: "https://cencori.com/api/v1/chat/completions",
                    sendHeaders: true,
                    headerParameters: {
                        parameters: [
                            { name: "Content-Type", value: "application/json" },
                            { name: "Authorization", value: "Bearer {{$env.CENCORI_API_KEY}}" },
                            { name: "X-Agent-ID", value: "{{$env.CENCORI_AGENT_ID}}" },
                        ],
                    },
                    sendBody: true,
                    contentType: "json",
                    specificationBody: "json",
                    jsonBody: JSON.stringify({
                        model,
                        messages: [{ role: "user", content: "={{$json.body?.prompt || \"Hello from n8n\"}}" }],
                    }),
                },
            },
            {
                id: "Respond_1",
                name: "Respond to Webhook",
                type: "n8n-nodes-base.respondToWebhook",
                typeVersion: 1,
                position: [860, 300],
                parameters: {
                    respondWith: "json",
                    responseBody: "={{$json}}",
                },
            },
        ],
        connections: {
            Webhook: {
                main: [[{ node: "Cencori Chat Completion", type: "main", index: 0 }]],
            },
            "Cencori Chat Completion": {
                main: [[{ node: "Respond to Webhook", type: "main", index: 0 }]],
            },
        },
        settings: {
            executionOrder: "v1",
        },
        staticData: null,
    };
}

export async function installN8nStarterWorkflow(agentId: string, path: string) {
    const supabase = await createServerClient();

    const [{ data: conn, error: connError }, { data: config }] = await Promise.all([
        supabase
            .from("agent_n8n_connections")
            .select("base_url, api_key_encrypted, starter_workflow_id")
            .eq("agent_id", agentId)
            .maybeSingle(),
        supabase
            .from("agent_configs")
            .select("model")
            .eq("agent_id", agentId)
            .maybeSingle(),
    ]);

    if (connError || !conn) {
        throw new Error("Connect n8n first before installing a starter workflow");
    }

    const organizationId = await getAgentOrganizationId(supabase, agentId);
    const apiKey = decryptApiKey(conn.api_key_encrypted, organizationId);
    const baseUrl = normalizeN8nBaseUrl(conn.base_url);
    const model = config?.model || "gpt-4o-mini";
    const payload = buildStarterN8nWorkflow(agentId, model);
    const starterName = getStarterWorkflowName(agentId);

    try {
        let workflowId: string | null = conn.starter_workflow_id || null;

        if (workflowId) {
            try {
                await n8nRequest(baseUrl, apiKey, `/api/v1/workflows/${workflowId}`);
            } catch {
                workflowId = null;
            }
        }

        if (!workflowId) {
            const workflows = await n8nRequest<{ data?: Array<{ id?: string; name?: string }> }>(
                baseUrl,
                apiKey,
                "/api/v1/workflows?limit=100"
            );
            const existing = workflows?.data?.find(
                (w) => w.name === starterName || w.name?.includes(`Cencori Starter (${agentId})`)
            );
            workflowId = existing?.id || null;
        }

        if (workflowId) {
            await n8nRequest(baseUrl, apiKey, `/api/v1/workflows/${workflowId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
        } else {
            const created = await n8nRequest<{ id?: string; data?: { id?: string } }>(
                baseUrl,
                apiKey,
                "/api/v1/workflows",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                }
            );
            workflowId = created?.id || created?.data?.id || null;
        }

        if (!workflowId) {
            throw new Error("n8n did not return workflow ID");
        }

        const workflowUrl = workflowId ? `${baseUrl}/workflow/${workflowId}` : null;

        await supabase
            .from("agent_n8n_connections")
            .update({
                connection_status: "connected",
                last_error: null,
                last_tested_at: new Date().toISOString(),
                starter_workflow_id: workflowId,
                starter_workflow_url: workflowUrl,
                starter_template_version: STARTER_TEMPLATE_VERSION,
                starter_installed_at: new Date().toISOString(),
            })
            .eq("agent_id", agentId);

        revalidatePath(path);
        return {
            success: true,
            workflowId: workflowId as string | null,
            workflowUrl,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create workflow in n8n";
        await supabase
            .from("agent_n8n_connections")
            .update({
                connection_status: "error",
                last_error: message,
                last_tested_at: new Date().toISOString(),
            })
            .eq("agent_id", agentId);
        revalidatePath(path);
        throw new Error(message);
    }
}

export async function setN8nWorkflowActive(
    agentId: string,
    path: string,
    active: boolean
) {
    const supabase = await createServerClient();
    const { data: conn, error } = await supabase
        .from("agent_n8n_connections")
        .select("base_url, api_key_encrypted, starter_workflow_id")
        .eq("agent_id", agentId)
        .maybeSingle();

    if (error || !conn?.starter_workflow_id) {
        throw new Error("Install starter workflow first");
    }

    const organizationId = await getAgentOrganizationId(supabase, agentId);
    const apiKey = decryptApiKey(conn.api_key_encrypted, organizationId);
    const baseUrl = normalizeN8nBaseUrl(conn.base_url);

    try {
        await n8nRequest(baseUrl, apiKey, `/api/v1/workflows/${conn.starter_workflow_id}/${active ? "activate" : "deactivate"}`, {
            method: "POST",
        });
    } catch {
        await n8nRequest(baseUrl, apiKey, `/api/v1/workflows/${conn.starter_workflow_id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active }),
        });
    }

    await supabase
        .from("agent_n8n_connections")
        .update({
            starter_workflow_active: active,
            connection_status: "connected",
            last_error: null,
            last_tested_at: new Date().toISOString(),
        })
        .eq("agent_id", agentId);

    revalidatePath(path);
    return { success: true };
}

export async function syncN8nWorkflowHealth(agentId: string, path: string) {
    const supabase = await createServerClient();
    const { data: conn, error } = await supabase
        .from("agent_n8n_connections")
        .select("base_url, api_key_encrypted, starter_workflow_id")
        .eq("agent_id", agentId)
        .maybeSingle();

    if (error || !conn?.starter_workflow_id) {
        throw new Error("Install starter workflow first");
    }

    const organizationId = await getAgentOrganizationId(supabase, agentId);
    const apiKey = decryptApiKey(conn.api_key_encrypted, organizationId);
    const baseUrl = normalizeN8nBaseUrl(conn.base_url);

    type N8nExec = {
        workflowId?: string;
        workflow_id?: string;
        status?: string;
        finished?: boolean;
        startedAt?: string;
        stoppedAt?: string;
    };
    const executions = await n8nRequest<{ data?: N8nExec[] }>(
        baseUrl,
        apiKey,
        `/api/v1/executions?limit=50&workflowId=${conn.starter_workflow_id}`
    );

    const rows = (executions.data || []).filter((row) => {
        const wid = row.workflowId || row.workflow_id;
        return !wid || String(wid) === String(conn.starter_workflow_id);
    });

    const finishedRows = rows.filter((r) => r.finished || r.status === "success" || r.status === "error");
    const successRows = finishedRows.filter((r) => r.status === "success");
    const successRate = finishedRows.length > 0 ? Number(((successRows.length / finishedRows.length) * 100).toFixed(1)) : null;

    const durations = finishedRows
        .map((r) => {
            if (!r.startedAt || !r.stoppedAt) return null;
            const ms = new Date(r.stoppedAt).getTime() - new Date(r.startedAt).getTime();
            return ms > 0 ? ms : null;
        })
        .filter((v): v is number => v !== null);

    const avgDuration = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null;

    const latest = rows[0];
    await supabase
        .from("agent_n8n_connections")
        .update({
            last_execution_at: latest?.stoppedAt || latest?.startedAt || null,
            last_execution_status: latest?.status || null,
            execution_success_rate: successRate,
            execution_avg_duration_ms: avgDuration,
            connection_status: "connected",
            last_error: null,
            last_tested_at: new Date().toISOString(),
        })
        .eq("agent_id", agentId);

    revalidatePath(path);
    return { success: true };
}

/**
 * Get agent-specific telemetry for dashboard widgets.
 */
export async function getAgentTelemetry(agentId: string): Promise<AgentTelemetry> {
    const supabase = await createServerClient();

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const { data: agentRecord, error: agentError } = await supabase
        .from("agents")
        .select("project_id")
        .eq("id", agentId)
        .single();

    if (agentError || !agentRecord) {
        throw new Error("Agent not found");
    }

    const { data: keyRows } = await supabase
        .from("api_keys")
        .select("id")
        .eq("project_id", agentRecord.project_id)
        .like("name", `Agent ${agentId} Key%`);

    const keyIds = (keyRows || []).map((k: { id: string }) => k.id);
    if (keyIds.length === 0) {
        return {
            reqPerSec: 0,
            p95LatencyMs: 0,
            errorRatePct: 0,
            tokensPerMin: 0,
            costTodayUsd: 0,
            points: [],
            apiKeyIds: [],
        };
    }

    const { data: hourRequests } = await supabase
        .from("ai_requests")
        .select("created_at, status, latency_ms, total_tokens, cost_usd")
        .in("api_key_id", keyIds)
        .gte("created_at", oneHourAgo.toISOString())
        .lte("created_at", now.toISOString())
        .order("created_at", { ascending: true });

    const { data: dayRequests } = await supabase
        .from("ai_requests")
        .select("cost_usd")
        .in("api_key_id", keyIds)
        .gte("created_at", startOfDay.toISOString())
        .lte("created_at", now.toISOString());

    const hourData = hourRequests || [];
    const dayData = dayRequests || [];

    const recentFiveMin = hourData.filter((r: { created_at: string }) => new Date(r.created_at) >= fiveMinutesAgo);
    const reqPerSec = recentFiveMin.length / 300;

    const latencies = hourData
        .map((r: { latency_ms: number | null }) => r.latency_ms)
        .filter((l): l is number => l !== null)
        .sort((a, b) => a - b);
    const p95LatencyMs = latencies.length > 0
        ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))]
        : 0;

    const errorCount = hourData.filter((r: { status: string }) => r.status === "error").length;
    const errorRatePct = hourData.length > 0 ? (errorCount / hourData.length) * 100 : 0;

    const tokensLastFiveMin = recentFiveMin.reduce(
        (sum: number, r: { total_tokens: number | null }) => sum + (r.total_tokens || 0),
        0
    );
    const tokensPerMin = tokensLastFiveMin / 5;

    const costTodayUsd = dayData.reduce(
        (sum: number, r: { cost_usd: number | null }) => sum + (r.cost_usd || 0),
        0
    );

    const bucketMs = 5 * 60 * 1000;
    const bucketCount = 12;
    const points: TelemetryPoint[] = Array.from({ length: bucketCount }, (_, i) => {
        const bucketStart = new Date(oneHourAgo.getTime() + i * bucketMs);
        const bucketEnd = new Date(bucketStart.getTime() + bucketMs);
        const bucketItems = hourData.filter((r: { created_at: string }) => {
            const t = new Date(r.created_at).getTime();
            return t >= bucketStart.getTime() && t < bucketEnd.getTime();
        });

        const bucketLatencies = bucketItems
            .map((r: { latency_ms: number | null }) => r.latency_ms)
            .filter((l): l is number => l !== null)
            .sort((a, b) => a - b);
        const bucketP95 = bucketLatencies.length > 0
            ? bucketLatencies[Math.min(bucketLatencies.length - 1, Math.floor(bucketLatencies.length * 0.95))]
            : 0;
        const bucketErrors = bucketItems.filter((r: { status: string }) => r.status === "error").length;
        const bucketErrorRate = bucketItems.length > 0 ? (bucketErrors / bucketItems.length) * 100 : 0;
        const bucketTokens = bucketItems.reduce(
            (sum: number, r: { total_tokens: number | null }) => sum + (r.total_tokens || 0),
            0
        );
        const bucketCost = bucketItems.reduce(
            (sum: number, r: { cost_usd: number | null }) => sum + (r.cost_usd || 0),
            0
        );

        return {
            ts: bucketStart.toISOString(),
            reqPerSec: bucketItems.length / 300,
            p95LatencyMs: bucketP95,
            errorRatePct: bucketErrorRate,
            tokensPerMin: bucketTokens / 5,
            costUsd: bucketCost,
        };
    });

    return {
        reqPerSec,
        p95LatencyMs: Math.round(p95LatencyMs),
        errorRatePct,
        tokensPerMin,
        costTodayUsd,
        points,
        apiKeyIds: keyIds,
    };
}

/**
 * Delete Agent
 */
export async function deleteAgent(agentId: string, orgSlug: string, projectSlug: string) {
    const supabase = await createServerClient();

    const { error } = await supabase
        .from('agents')
        .delete()
        .eq('id', agentId);

    if (error) {
        console.error("Error deleting agent:", error);
        throw new Error("Failed to delete agent");
    }

    redirect(`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/agents`);
}
