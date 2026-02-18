"use server";

import { createServerClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import crypto from 'crypto';

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
