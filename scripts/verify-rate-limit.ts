
import fs from 'fs';
import path from 'path';

// Load .env.local manually BEFORE importing modules that rely on env vars
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

async function runVerification() {
    // Dynamic import to ensure env vars are loaded
    const { checkRateLimit } = await import('../lib/rate-limit');

    const projectId = 'test-project-rate-limit-' + Date.now();
    console.log(`Testing rate limit for project: ${projectId}`);

    // Simulation params
    const LIMIT = 60; // Should match lib/rate-limit.ts
    const TOTAL_REQUESTS = 65;

    console.log(`Simulating ${TOTAL_REQUESTS} requests (Limit: ${LIMIT})...`);

    console.log(`Simulating ${TOTAL_REQUESTS} requests (Limit: ${LIMIT}) concurrently...`);

    const promises = [];
    for (let i = 1; i <= TOTAL_REQUESTS; i++) {
        promises.push(checkRateLimit(projectId).then(res => ({ i, ...res })));
    }

    const results = await Promise.all(promises);

    // Sort by index to printing makes sense, though execution order varies
    results.sort((a, b) => a.i - b.i);

    let failures = 0;
    let blocked = 0;

    for (const result of results) {
        if (result.i <= LIMIT && !result.success) {
            console.error(`❌ Req ${result.i} failed prematurely (success=false)`);
            failures++;
        }
        if (result.i > LIMIT && result.success) {
            // In concurrent/race conditions, exact cutoff might be fuzzy by 1-2, 
            // but we expect significant blocking at the end.
            // However, Redis INCR is atomic, so it SHOULD be exact.
            console.error(`❌ Req ${result.i} should have been blocked (success=true, remaining=${result.remaining})`);
            failures++;
        }
        if (!result.success) blocked++;
    }

    console.log(`\nResults: ${blocked} blocked, ${TOTAL_REQUESTS - blocked} allowed.`);

    if (failures > 0) {
        console.error(`\n❌ Verification Failed with ${failures} anomalies.`);
        // Note: In high concurrency, 'i' is just the loop index, not the order of reaching Redis.
        // So "Req 65" might reach Redis before "Req 60". 
        // We should verify that EXACTLY 60 were allowed.
        const allowedCount = results.filter(r => r.success).length;
        console.log(`Total Allowed: ${allowedCount} (Expected: ${LIMIT})`);
        if (allowedCount > LIMIT) {
            console.error('❌ Too many requests allowed!');
        } else if (allowedCount < LIMIT) {
            console.error('❌ Too few requests allowed (some failed prematurely)!');
        } else {
            console.log('✅ Exactly 60 requests allowed. Pass!');
        }
    } else {
        console.log('\n✅ Rate limit verification passed!');
    }

}

runVerification();
