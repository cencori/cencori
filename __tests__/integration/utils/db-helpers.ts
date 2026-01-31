/**
 * Database Helper Utilities for Integration Tests
 * 
 * Provides utilities for:
 * - Creating test data (projects, users, API keys)
 * - Cleaning up test data after tests
 * - Getting test database client
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Prefix for test data to identify and clean up
const TEST_DATA_PREFIX = 'test_';

// Store created test data IDs for cleanup
const createdTestData: {
    projects: string[];
    apiKeys: string[];
    users: string[];
} = {
    projects: [],
    apiKeys: [],
    users: [],
};

/**
 * Get a Supabase client for testing (uses service role key)
 */
export function getTestSupabaseClient(): SupabaseClient {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        throw new Error(
            'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
            'Set these environment variables to run integration tests.'
        );
    }

    return createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

/**
 * Check if Supabase is available for testing
 */
export function isSupabaseAvailable(): boolean {
    return !!(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
}

/**
 * Create a test project
 */
export async function seedTestProject(overrides: Partial<{
    name: string;
    slug: string;
    userId: string;
    organizationId: string;
}> = {}): Promise<{ id: string; name: string; slug: string }> {
    const supabase = getTestSupabaseClient();

    const projectData = {
        name: overrides.name || `${TEST_DATA_PREFIX}Project_${Date.now()}`,
        slug: overrides.slug || `${TEST_DATA_PREFIX}slug_${Date.now()}`,
        user_id: overrides.userId || null,
        organization_id: overrides.organizationId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from('projects')
        .insert(projectData)
        .select('id, name, slug')
        .single();

    if (error) {
        throw new Error(`Failed to create test project: ${error.message}`);
    }

    // Track for cleanup
    createdTestData.projects.push(data.id);

    return data;
}

/**
 * Create a test API key
 */
export async function seedTestApiKey(projectId: string, overrides: Partial<{
    name: string;
    keyPrefix: string;
    keyHash: string;
    lastFour: string;
}> = {}): Promise<{ id: string; name: string; keyPrefix: string }> {
    const supabase = getTestSupabaseClient();

    const apiKeyData = {
        project_id: projectId,
        name: overrides.name || `${TEST_DATA_PREFIX}Key_${Date.now()}`,
        key_prefix: overrides.keyPrefix || 'cen_test',
        key_hash: overrides.keyHash || `hash_${Date.now()}`,
        last_four: overrides.lastFour || 'TEST',
        created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from('api_keys')
        .insert(apiKeyData)
        .select('id, name, key_prefix')
        .single();

    if (error) {
        throw new Error(`Failed to create test API key: ${error.message}`);
    }

    // Track for cleanup
    createdTestData.apiKeys.push(data.id);

    return {
        id: data.id,
        name: data.name,
        keyPrefix: data.key_prefix,
    };
}

/**
 * Clean up all test data created during tests
 */
export async function cleanupTestData(): Promise<void> {
    if (!isSupabaseAvailable()) {
        return;
    }

    const supabase = getTestSupabaseClient();

    // Clean up in reverse order of dependencies

    // 1. Clean up API keys
    if (createdTestData.apiKeys.length > 0) {
        await supabase
            .from('api_keys')
            .delete()
            .in('id', createdTestData.apiKeys);
        createdTestData.apiKeys = [];
    }

    // 2. Clean up projects
    if (createdTestData.projects.length > 0) {
        await supabase
            .from('projects')
            .delete()
            .in('id', createdTestData.projects);
        createdTestData.projects = [];
    }

    // 3. Clean up any remaining test data by prefix (safety net)
    await supabase
        .from('projects')
        .delete()
        .like('name', `${TEST_DATA_PREFIX}%`);

    await supabase
        .from('api_keys')
        .delete()
        .like('name', `${TEST_DATA_PREFIX}%`);
}

/**
 * Get test data tracking (for debugging)
 */
export function getTrackedTestData() {
    return { ...createdTestData };
}
