import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Load .env.local manually BEFORE importing modules that rely on env vars
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, ...values] = line.split('=');
        if (key && values.length > 0) {
            const value = values.join('='); // Re-join in case value contains =
            process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
        }
    });
}

const API_URL = 'http://localhost:3000/api/ai/completions';

async function createTestKey(): Promise<{ rawKey: string, keyId: string } | null> {
    // Dynamic import to ensure env vars are loaded
    const { createAdminClient } = await import('../lib/supabaseAdmin');
    const supabase = createAdminClient();

    // 1. Get a project
    const { data: project } = await supabase
        .from('projects')
        .select('id')
        .limit(1)
        .single();

    if (!project) {
        console.error('No projects found to attach key to.');
        return null;
    }

    // 2. Generate Key
    const rawKey = `sk-test-${crypto.randomUUID()}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    // 3. Insert Key
    const { data: key, error } = await supabase
        .from('api_keys')
        .insert({
            project_id: project.id,
            key_hash: keyHash,
            name: 'Verification Script Key',
            key_type: 'secret',
            environment: 'production', // check constraint issue with 'live'
            key_prefix: 'sk-test',
            // Add other required fields if any? assuming defaults work or these are enough
        })
        .select('id')
        .single();

    if (error || !key) {
        console.error('Failed to create test key:', error);
        return null;
    }

    console.log(`Created test key for project ${project.id}`);
    return { rawKey, keyId: key.id };
}

async function cleanupTestKey(keyId: string) {
    const { createAdminClient } = await import('../lib/supabaseAdmin');
    const supabase = createAdminClient();
    await supabase.from('api_keys').delete().eq('id', keyId);
    console.log('Cleaned up test key');
}

async function testCompletion(apiKey: string) {
    console.log('Testing Standard Completion...');
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                prompt: 'Say hello to the world',
                max_tokens: 10,
            }),
        });

        if (!response.ok) {
            console.error('Standard Completion Failed:', response.status, await response.text());
            return;
        }

        const data = await response.json();
        console.log('Standard Completion Success:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Standard Completion Error:', error);
    }
}

async function testStreamingCompletion(apiKey: string) {
    console.log('\nTesting Streaming Completion...');
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                prompt: 'Count to 5',
                max_tokens: 20,
                stream: true,
            }),
        });

        if (!response.ok) {
            console.error('Streaming Completion Failed:', response.status, await response.text());
            return;
        }

        console.log('Streaming Completion Started...');
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                // Just print a summary to avoid spam
                process.stdout.write(`Received chunk (${chunk.length} bytes)\r`);
            }
        }
        console.log('\nStreaming Completion Finished.');

    } catch (error) {
        console.error('Streaming Completion Error:', error);
    }
}

async function main() {
    const testKey = await createTestKey();
    if (!testKey) return;

    try {
        await testCompletion(testKey.rawKey);
        await testStreamingCompletion(testKey.rawKey);
    } finally {
        await cleanupTestKey(testKey.keyId);
    }
}

main();
