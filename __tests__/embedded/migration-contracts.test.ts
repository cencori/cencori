import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const claimRepairSql = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260923_170000_embedded_claim_idempotency_match.sql'),
    'utf8'
);

describe('embedded migration contracts', () => {
    it('uses null-safe equality for every retry identity field in the race fallback', () => {
        const fallback = claimRepairSql.match(
            /EXCEPTION WHEN unique_violation THEN([\s\S]*?)RAISE EXCEPTION 'idempotency_conflict'/
        )?.[1];

        expect(fallback).toBeDefined();
        expect(fallback).toContain('v_existing.parent_run_id IS NOT DISTINCT FROM p_parent_run_id');
        expect(fallback).toContain('v_existing.tenant_id IS NOT DISTINCT FROM v_parent.tenant_id');
        expect(fallback).toContain('v_existing.agent_version_id IS NOT DISTINCT FROM p_child_version_id');
        expect(fallback).toContain('v_existing.installation_id IS NOT DISTINCT FROM p_child_installation_id');
        expect(fallback).toContain('v_existing.input_ref IS NOT DISTINCT FROM v_input');

        expect(fallback).not.toMatch(
            /v_existing\.(?:parent_run_id|tenant_id|agent_version_id|installation_id|input_ref) IS DISTINCT FROM/
        );
    });

    it('changes only the existing claim function and preserves its restricted ACL', () => {
        expect(claimRepairSql.match(/CREATE OR REPLACE FUNCTION/g)).toHaveLength(1);
        expect(claimRepairSql).not.toMatch(/\b(?:CREATE|ALTER|DROP)\s+TABLE\b/i);
        expect(claimRepairSql).toContain(
            'REVOKE ALL ON FUNCTION public.claim_embedded_subagent_run(uuid, uuid, uuid, uuid, jsonb, text)'
        );
        expect(claimRepairSql).toContain(
            'GRANT EXECUTE ON FUNCTION public.claim_embedded_subagent_run(uuid, uuid, uuid, uuid, jsonb, text)'
        );
    });
});
