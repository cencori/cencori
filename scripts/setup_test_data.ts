import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const testApiKey = process.env.CENCORI_API_KEY || 'cencori_test_key_12345';

// Valid UUIDs for testing agents (Fixed ID for consistency with test script)
const agentId = '22222222-2222-4222-a222-222222222222';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    console.log("Seeding test data...");

    // 0. Fetch valid Project ID
    const { data: project, error: projError } = await supabase
        .from('projects')
        .select('id')
        .limit(1)
        .single();

    if (projError || !project) {
        console.error("❌ Could not find any project. Create a project in the dashboard first.", projError);
        process.exit(1);
    }
    const projectId = project.id;
    console.log(`✅ Using Project ID: ${projectId}`);

    // 1. Create API Key
    const keyHash = crypto.createHash('sha256').update(testApiKey).digest('hex');

    // Use INSERT instead of UPSERT because key_hash doesn't have unique constraint
    const { error: keyError } = await supabase.from('api_keys').insert({
        key_hash: keyHash,
        project_id: projectId,
        name: 'OpenClaw Test Key',
        key_prefix: 'cencori' // Required field
    });

    if (keyError) {
        console.error("Error creating API key (might already exist):", keyError.message);
    } else console.log("✅ API Key created.");

    // 2. Create Agent
    const { error: agentError } = await supabase.from('agents').upsert({
        id: agentId,
        project_id: projectId,
        name: 'OpenClaw Test Agent',
        blueprint: 'openclaw',
        is_active: true,
        shadow_mode: true
    }, { onConflict: 'id' });

    if (agentError) console.error("Error creating Agent:", agentError);
    else console.log("✅ Agent created.");

    // 3. Create Agent Config
    const { error: configError } = await supabase.from('agent_configs').upsert({
        agent_id: agentId,
        model: 'gemini-2.5-flash',
        system_prompt: 'You are a test agent.',
        temperature: 0.7
    }, { onConflict: 'agent_id' });

    if (configError) console.error("Error creating agent config:", configError);
    else console.log("✅ Agent Config created.");

    console.log("\n⚠️  Agent ID: " + agentId);
}

main();
