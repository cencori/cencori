/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import {
    seedGatewayProjectBundle,
    warmGatewayProjectConfig,
    type GatewayProjectBundle,
} from '@/lib/gateway/request-config';
import {
    getCachedCacheConfig,
    getCachedCustomRules,
    getCachedFailoverConfig,
    getCachedNetworkConfig,
    getCachedProviderConfig,
    getCachedSecurityConfig,
} from '@/lib/config-cache';
import type { ProjectNetworkPolicy } from '@/lib/networking/project-network-policy';

const bundle: GatewayProjectBundle = {
    network: { access_mode: 'public', allowed_cidrs: [] },
    security: {
        security_enabled: true,
        safety_threshold: 0.8,
        filter_jailbreaks: false,
        filter_pii: true,
        filter_prompt_injection: true,
    },
    custom_rules: [
        {
            id: 'r1',
            project_id: 'p',
            name: 'rule',
            match_type: 'keywords',
            pattern: 'secret',
            case_sensitive: false,
            action: 'block',
            is_active: true,
            priority: 1,
        },
    ],
    failover: { enable_fallback: true, max_retries_before_fallback: 2 },
    provider_keys: [
        {
            provider: 'anthropic',
            encrypted_key: 'enc-anthropic',
            key_hint: 'hint',
            is_active: true,
            default_model: 'claude-sonnet-4-5',
        },
        {
            provider: 'openai',
            encrypted_key: 'enc-openai',
            is_active: false,
            default_model: null,
            key_hint: null,
        },
    ],
    embedded_keys: [
        {
            id: 'conn-1',
            provider: 'google',
            status: 'active',
            base_url: null,
            encrypted_key_ref: 'enc-google-embedded',
            key_hint: 'g-hint',
            created_at: new Date().toISOString(),
        },
    ],
    cache_settings: {
        cache_enabled: false,
        exact_match_enabled: true,
        semantic_match_enabled: false,
        ttl_seconds: 3600,
        similarity_threshold: 0.9,
        max_entries: 100,
        excluded_models: [],
        max_cacheable_temperature: 0,
    },
};

describe('gateway request config split', () => {
    it('seeds every per-concern cache from one bundle', async () => {
        const projectId = randomUUID();
        seedGatewayProjectBundle(projectId, bundle);

        const security = await getCachedSecurityConfig(projectId);
        expect(security?.data.enabled).toBe(true);
        expect(security?.data.inputThreshold).toBe(0.8);
        expect(security?.data.outputThreshold).toBeCloseTo(0.7);
        expect(security?.data.filterJailbreaks).toBe(false);

        expect(await getCachedCustomRules(projectId)).toHaveLength(1);

        const failover = await getCachedFailoverConfig(projectId);
        expect(failover?.max_retries_before_fallback).toBe(2);

        const network = await getCachedNetworkConfig<ProjectNetworkPolicy>(projectId);
        expect(network?.data.accessMode).toBe('public');

        const cache = await getCachedCacheConfig(projectId);
        expect(cache?.data.cacheEnabled).toBe(false);

        // Dashboard rows seed verbatim (active and inactive alike).
        const anthropic = await getCachedProviderConfig(projectId, 'anthropic');
        expect(anthropic?.row.encrypted_key).toBe('enc-anthropic');
        const openai = await getCachedProviderConfig(projectId, 'openai');
        expect(openai?.row.is_active).toBe(false);

        // Embedded fallback fills providers with no dashboard row.
        const google = await getCachedProviderConfig(projectId, 'google');
        expect(google?.row.encrypted_key).toBe('enc-google-embedded');
        expect(google?.row.is_active).toBe(true);
    });

    it('falls back to defaults on an empty bundle', async () => {
        const projectId = randomUUID();
        seedGatewayProjectBundle(projectId, {});

        const security = await getCachedSecurityConfig(projectId);
        expect(security?.data.enabled).toBe(false);
        expect(security?.data.inputThreshold).toBe(0.5);
        expect(await getCachedCustomRules(projectId)).toEqual([]);
        expect(await getCachedFailoverConfig(projectId)).toEqual({});
        const network = await getCachedNetworkConfig<ProjectNetworkPolicy>(projectId);
        expect(network?.data.accessMode).toBe('public');
        expect(await getCachedProviderConfig(projectId, 'anthropic')).toBeNull();
    });

    it('warms via RPC once, then serves from memory', async () => {
        const projectId = randomUUID();
        let rpcCalls = 0;
        const supabase = {
            rpc: async () => {
                rpcCalls += 1;
                return { data: bundle, error: null };
            },
        };

        expect(await warmGatewayProjectConfig(supabase as never, projectId)).toBe('refreshed');
        expect(rpcCalls).toBe(1);
        // Seeded entries are now readable without any further I/O.
        expect((await getCachedSecurityConfig(projectId))?.data.inputThreshold).toBe(0.8);

        expect(await warmGatewayProjectConfig(supabase as never, projectId)).toBe('warm');
        expect(rpcCalls).toBe(1);
    });

    it('fails open to per-reader paths when the RPC errors', async () => {
        const projectId = randomUUID();
        const supabase = {
            rpc: async () => ({ data: null, error: { message: 'down' } }),
        };
        expect(await warmGatewayProjectConfig(supabase as never, projectId)).toBe('bypass');
        expect(await getCachedFailoverConfig(projectId)).toBeNull();
    });
});
