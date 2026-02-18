
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service key to bypass RLS for debugging
);

async function checkConfigs() {
    const { data: agents, error: agentsError } = await supabase
        .from('agents')
        .select(`
            id, 
            name, 
            agent_configs (
                model, 
                system_prompt
            )
        `);

    if (agentsError) {
        console.error('Error fetching agents:', agentsError);
        return;
    }

    console.log('--- Agents & Configs ---');
    agents.forEach(agent => {
        console.log(`Agent: ${agent.name} (${agent.id})`);
        console.log(`Config:`, agent.agent_configs);
    });
}

checkConfigs();
