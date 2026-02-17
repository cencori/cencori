
import fs from 'fs';
import path from 'path';
import { createAdminClient } from '../lib/supabaseAdmin';

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, ...values] = line.split('=');
        if (key && values.length > 0) {
            const value = values.join('=');
            process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
        }
    });
}

// Helper to create a temp key
async function getTestKey() {
    // Dynamic import to ensure env vars are loaded
    const { createAdminClient } = await import('../lib/supabaseAdmin');
    const supabase = createAdminClient();

    // Find a project
    const { data: project } = await supabase.from('projects').select('id').limit(1).single();
    if (!project) throw new Error('No project found');

    // Try to find an existing key to use
    const { data: existingKey } = await supabase
        .from('api_keys')
        .select('key_hash, id')
        .limit(1)
        .single();

    if (existingKey) {
        console.log('Using existing API key from DB (simulating match)...');
        // We can't know the raw key for the hash, so this strategy fails unless we have the raw key.
        // Actually, we can't reverse the hash. 
        // We MUST verify using the env var CENCORI_API_KEY if we can't create one.
    }

    if (process.env.CENCORI_API_KEY) {
        console.log('Using CENCORI_API_KEY from env');
        return process.env.CENCORI_API_KEY;
    }

    // specific hack for this environment if we know a valid key?
    // Or try to insert with a random UUID for created_by?
    const { data: user } = await supabase.auth.admin.listUsers();
    const userId = user.users[0]?.id;

    if (!userId) {
        throw new Error('No users found to create key with, and no CENCORI_API_KEY in env');
    }

    const rawKey = `sk-verify-caching-${Date.now()}`;
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const { data: key, error } = await supabase.from('api_keys').insert({
        key_hash: hash,
        key_prefix: 'sk-verify', // Required column
        project_id: project.id,
        name: 'Verify Caching Script',
        created_by: userId
    }).select('id').single();

    if (error) throw error;

    return { key: rawKey, id: key.id, cleanup: async () => supabase.from('api_keys').delete().eq('id', key.id) };
}

async function runVerification() {
    let testKeyData;
    try {
        testKeyData = await getTestKey();
        const apiKey = typeof testKeyData === 'string' ? testKeyData : testKeyData.key;

        const API_URL = 'http://localhost:3000/api/ai/completions';
        console.log(`Testing Caching at ${API_URL}`);

        const payload = {
            model: 'gemini-2.5-flash',
            prompt: 'Convert "Hello World" to uppercase.',
            temperature: 0,
            max_tokens: 10
        };

        // 1. First Request (Expect MISS)
        console.log('\nRequest 1 (Fresh)...');
        const start1 = Date.now();
        const res1 = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'CENCORI_API_KEY': apiKey },
            body: JSON.stringify(payload)
        });
        const lat1 = Date.now() - start1;
        const cache1 = res1.headers.get('X-Cencori-Cache');
        console.log(`Status: ${res1.status}, Cache: ${cache1}, Latency: ${lat1}ms`);

        if (cache1 !== 'MISS') console.error('❌ Expected MISS on first request');

        // Wait a bit for async cache save
        await new Promise(r => setTimeout(r, 1000));

        // 2. Second Request (Expect HIT)
        console.log('\nRequest 2 (Cached)...');
        const start2 = Date.now();
        const res2 = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'CENCORI_API_KEY': apiKey },
            body: JSON.stringify(payload)
        });
        const lat2 = Date.now() - start2;
        const cache2 = res2.headers.get('X-Cencori-Cache');
        console.log(`Status: ${res2.status}, Cache: ${cache2}, Latency: ${lat2}ms`);

        if (cache2 !== 'HIT') {
            console.error('❌ Expected HIT on second request. Cache failed.');
        } else {
            console.log('✅ Cache HIT verified!');
            if (lat2 < lat1) console.log('✅ Latency reduced.');
        }

        // 3. Varied Request (Expect MISS)
        console.log('\nRequest 3 (Varied Prompt)...');
        payload.prompt = 'Convert "Foo Bar" to uppercase.';
        const start3 = Date.now();
        const res3 = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'CENCORI_API_KEY': apiKey },
            body: JSON.stringify(payload)
        });
        const cache3 = res3.headers.get('X-Cencori-Cache');
        console.log(`Status: ${res3.status}, Cache: ${cache3}`);

        if (cache3 !== 'MISS') console.error('❌ Expected MISS on new prompt');

    } catch (e) {
        console.error('Test failed', e);
    } finally {
        if (testKeyData && typeof testKeyData !== 'string') {
            await testKeyData.cleanup();
            console.log('\nCleaned up test key.');
        }
    }
}

runVerification();
