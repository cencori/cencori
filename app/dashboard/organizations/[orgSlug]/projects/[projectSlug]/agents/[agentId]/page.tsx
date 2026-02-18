import { createServerClient } from "@/lib/supabaseServer";
import AgentConfigClient from "./AgentConfigClient";
import { notFound } from "next/navigation";

interface AgentPageProps {
    params: Promise<{
        orgSlug: string;
        projectSlug: string;
        agentId: string;
    }>
}

export default async function AgentPage({ params }: AgentPageProps) {
    const { orgSlug, projectSlug, agentId } = await params;

    // 1. Init Supabase
    const supabase = await createServerClient();

    // 2. Fetch Agent Data
    // Join with Config
    const { data: agentData, error } = await supabase
        .from('agents')
        .select(`
            *,
            agent_configs (
                model,
                system_prompt
            )
        `)
        .eq('id', agentId)
        .single();

    if (error || !agentData) {
        notFound();
    }

    // Flatten data for the client
    // Flatten data for the client
    // Supabase returns object for 1:1, array for 1:N
    const config = Array.isArray(agentData.agent_configs)
        ? agentData.agent_configs[0]
        : agentData.agent_configs;

    const agent = {
        ...agentData,
        model: config?.model || "gpt-4o",
        system_prompt: config?.system_prompt || "",
    };

    // 3. Fetch Keys (Check if exists)
    const { data: apiKeyData } = await supabase
        .from('api_keys')
        .select('key_hash')
        .eq('project_id', agentData.project_id)
        .like('name', `Agent ${agentId} Key%`)
        .limit(1)
        .maybeSingle();

    // 4. Render Client Component
    return (
        <AgentConfigClient
            agent={agent}
            apiKey={apiKeyData?.key_hash ? "cake_*****************" : null} // Don't expose hash, just presence
            orgSlug={orgSlug}
            projectSlug={projectSlug}
        />
    );
}
