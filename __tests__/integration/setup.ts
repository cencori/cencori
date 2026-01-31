/**
 * Integration Test Setup
 * 
 * This file runs before all integration tests.
 * It validates environment variables and sets up global test utilities.
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { cleanupTestData, getTestSupabaseClient } from './utils/db-helpers';

// Validate required environment variables
const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
];

beforeAll(async () => {
    // Check for required environment variables
    const missingVars = requiredEnvVars.filter((v) => !process.env[v]);

    if (missingVars.length > 0) {
        console.warn(
            `⚠️ Missing environment variables for integration tests: ${missingVars.join(', ')}\n` +
            'Some tests may be skipped. Set these variables to run full integration tests.'
        );
    }

    // Verify Supabase connection if credentials are available
    if (!missingVars.length) {
        try {
            const supabase = getTestSupabaseClient();
            const { error } = await supabase.from('projects').select('count').limit(1);
            if (error) {
                console.warn(`⚠️ Supabase connection test failed: ${error.message}`);
            } else {
                console.log('✅ Supabase connection verified');
            }
        } catch (err) {
            console.warn('⚠️ Could not verify Supabase connection');
        }
    }
});

afterAll(async () => {
    // Clean up any remaining test data
    try {
        await cleanupTestData();
        console.log('✅ Test cleanup completed');
    } catch (err) {
        console.warn('⚠️ Test cleanup encountered an error:', err);
    }
});

// Track test data created in each test for cleanup
beforeEach(() => {
    // Reset test data tracking before each test
});

afterEach(async () => {
    // Optional: Clean up after each test for isolation
    // await cleanupTestData();
});
