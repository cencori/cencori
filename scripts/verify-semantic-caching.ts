import { config } from 'dotenv';
config({ path: '.env.local' });
process.env.MOCK_EMBEDDINGS = 'true'; // Enable mock embeddings for verification

const API_URL = 'http://localhost:3000/api/ai/completions';
const API_KEY = process.env.CENCORI_API_KEY || 'csk_test_68044d62f550c28a1a0f3962e9670be71a63ec801ce23884';

async function runVerification() {
    console.log('🧪 Verifying Vector Semantic Caching...');

    console.log('🧪 Verifying Vector Semantic Caching (Supabase pgvector)...');

    const ts = Date.now() + 100; // Update timestamp final
    const prompt1 = `What is the capital of Atlantis ${ts}?`;
    const prompt2 = `Tell me the capital city of Atlantis ${ts}.`; // Semantically same
    const prompt3 = `What is the capital of El Dorado ${ts}?`; // Different

    // 1. First Request (Fresh)
    console.log(`\n1️⃣  Request 1: "${prompt1}"`);
    const t1 = Date.now();
    const res1 = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
            prompt: prompt1,
            model: 'gemini-2.5-flash',
            max_tokens: 50
        })
    });
    console.log(`   Status: ${res1.status}, Cache: ${res1.headers.get('X-Cencori-Cache')}, Time: ${Date.now() - t1}ms`);
    console.log(`   Debug Key: ${res1.headers.get('X-Debug-Key-Prefix')}`);
    if (res1.status !== 200) console.log('   Error:', await res1.text());

    // Wait for async save (embedding generation takes time)
    console.log('   Waiting 3s for vector embedding & save...');
    await new Promise(r => setTimeout(r, 3000));

    // 2. Second Request (Semantic Hit?)
    console.log(`\n2️⃣  Request 2: "${prompt2}"`);
    const t2 = Date.now();
    const res2 = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
            prompt: prompt2,
            model: 'gemini-2.5-flash',
            max_tokens: 50
        })
    });
    const cache2 = res2.headers.get('X-Cencori-Cache');
    console.log(`   Status: ${res2.status}, Cache: ${cache2}, Time: ${Date.now() - t2}ms`);
    if (res2.status !== 200) console.log('   Error:', await res2.text());

    if (cache2 === 'SEMANTIC-HIT') {
        console.log('✅ SUPABASE PGVECTOR WORKING! Semantic Hit verified.');
    } else {
        console.log('❌ Expected SEMANTIC-HIT but got ' + cache2);
        console.log('   (Note: First run might miss if embedding/indexing is slow)');
    }

    // 3. Third Request (Different)
    console.log(`\n3️⃣  Request 3: "${prompt3}"`);
    const t3 = Date.now();
    const res3 = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
            prompt: prompt3,
            model: 'gemini-2.5-flash',
            max_tokens: 50
        })
    });
    console.log(`   Status: ${res3.status}, Cache: ${res3.headers.get('X-Cencori-Cache')}, Time: ${Date.now() - t3}ms`);
    if (res3.status !== 200) console.log('   Error:', await res3.text());
}

runVerification();
