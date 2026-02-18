"use server";

import { createServerClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import crypto from 'crypto';

/**
 * Generate a new API Key for the agent (Legacy/BYOK style)
 * In a real app, this might be a Service Token.
 * Here we generate a `cake_` key and store the hash.
 */
export async function generateAgentKey(agentId: string, projectId: string) {
    const supabase = await createServerClient();

    // 1. Generate Key
    const rawKey = `cake_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    // 2. Revoke old keys for this agent? 
    // For now, we just add a new one. In future, we might want to list them.
    // Actually, let's keep it simple: One key per agent for this demo? 
    // The current schema links keys to `project_id`. 
    // We should probably add `name` to identify it's for this agent.

    const { error } = await supabase.from('api_keys').insert({
        project_id: projectId,
        key_hash: keyHash,
        key_prefix: 'cake_',
        name: `Agent Key (${agentId.slice(0, 8)})`
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
