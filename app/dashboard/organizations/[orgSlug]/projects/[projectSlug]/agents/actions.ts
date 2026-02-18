"use server";

import { createServerClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import crypto from "crypto";

export async function createAgent({
    orgSlug,
    projectSlug,
    projectId,
    blueprintId,
    name
}: {
    orgSlug: string;
    projectSlug: string;
    projectId: string;
    blueprintId: string;
    name: string;
}) {
    const supabase = await createServerClient();

    // 1. Create Agent
    const { data: agent, error: agentError } = await supabase
        .from("agents")
        .insert({
            project_id: projectId,
            name: name,
            blueprint: blueprintId,
            is_active: true,
            shadow_mode: true // Default to safe
        })
        .select()
        .single();

    if (agentError || !agent) {
        console.error("Error creating agent:", agentError);
        throw new Error("Failed to create agent");
    }

    // 2. Create Default Config
    // Different defaults per blueprint?
    let model = "gpt-4o";
    let systemPrompt = "You are a helpful assistant.";

    if (blueprintId === "openclaw") {
        model = "gemini-2.5-flash"; // Our validated model
        systemPrompt = "You are OpenClaw, an autonomous operator capable of controlling this computer.";
    }

    const { error: configError } = await supabase
        .from("agent_configs")
        .insert({
            agent_id: agent.id,
            model: model,
            system_prompt: systemPrompt,
            temperature: 0.7
        });

    if (configError) {
        console.error("Error creating config:", configError);
        // Clean up agent? Or just fail? For now, we'll let it be.
    }

    // 3. Generate Initial Key for the Wizard
    // We do this here so we can show it to the user immediately
    const rawKey = `cake_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const { error: keyError } = await supabase.from('api_keys').insert({
        project_id: projectId,
        key_hash: keyHash,
        key_prefix: 'cake_',
        name: `Agent ${agent.id} Key`
    });

    if (keyError) {
        console.error("Error creating initial key:", keyError);
        // functional but without key
    }

    revalidatePath(`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/agents`);

    return {
        success: true,
        agentId: agent.id,
        name: agent.name,
        apiKey: rawKey
    };
}
