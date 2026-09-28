import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const rpcSql = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260928_110000_security_explicit_optin.sql'),
    'utf8'
);

describe('gateway_project_config RPC contract', () => {
    it('is a read-only, service-role-only data-plane reader', () => {
        expect(rpcSql).toContain('create or replace function public.gateway_project_config(p_project_id uuid)');
        expect(rpcSql).toMatch(/security definer/i);
        // No writes: the data plane never mutates through this function.
        expect(rpcSql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
        expect(rpcSql).toContain('revoke all on function public.gateway_project_config(uuid) from public');
        expect(rpcSql).toContain('grant execute on function public.gateway_project_config(uuid) to service_role');
    });

    it('bundles every per-project config the hot path reads', () => {
        for (const table of [
            'project_network_policies',
            'security_settings',
            'custom_data_rules',
            'project_settings',
            'provider_keys',
            'provider_connections',
            'prompt_cache_settings',
        ]) {
            expect(rpcSql).toContain(table);
        }
        for (const key of [
            "'network'",
            "'security'",
            "'custom_rules'",
            "'failover'",
            "'provider_keys'",
            "'embedded_keys'",
            "'cache_settings'",
        ]) {
            expect(rpcSql).toContain(key);
        }
    });

    it('carries the explicit security opt-in switch', () => {
        expect(rpcSql).toContain('security_enabled');
    });

    it('returns nulls (not errors) for missing rows and caps embedded fan-out', () => {
        expect(rpcSql).toContain('limit 25');
        // Single-row sections use a scalar subselect (null when absent)…
        expect(rpcSql).toContain('select to_jsonb(t)');
        // …array sections coalesce to [] so the warmer never sees null arrays.
        expect(rpcSql).toContain("coalesce(jsonb_agg(to_jsonb(t)");
    });
});
