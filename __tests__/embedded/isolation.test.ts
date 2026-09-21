import { describe, expect, it } from 'vitest';
import { denyOnScopeMismatch, denyOnTenantMismatch, hasClientPermission } from '@/lib/embedded/session-auth';
import { dePrefixId, withPrefix } from '@/lib/embedded/http';
import { executionContextFromClientToken } from '@/lib/embedded/execution-context';

describe('cross-tenant isolation primitives', () => {
    it('denies tenant B access with tenant A scope', () => {
        const result = denyOnTenantMismatch(
            { project_id: 'proj_1', tenant_id: 'tenant-b' },
            'proj_1',
            { tenantId: 'tenant-a', externalUserId: 'u1' },
        );
        expect(result).toBe('tenant');
    });

    it('allows same-tenant access', () => {
        const result = denyOnTenantMismatch(
            { project_id: 'proj_1', tenant_id: 'tenant-a' },
            'proj_1',
            { tenantId: 'tenant-a', externalUserId: 'u1' },
        );
        expect(result).toBeNull();
    });

    it('denies cross-project access', () => {
        const result = denyOnTenantMismatch({ project_id: 'proj_2', tenant_id: null }, 'proj_1', null);
        expect(result).toBe('project');
    });

    it('allows unscoped legacy sessions for secret-key callers', () => {
        const result = denyOnTenantMismatch({ project_id: 'proj_1', tenant_id: null }, 'proj_1', null);
        expect(result).toBeNull();
    });

    it('client-token claims cannot be overridden by body scope', () => {
        const claims = {
            project_id: 'proj_1',
            env: 'test',
            tenant_id: 'tenant-a',
            external_user_id: 'u1',
            installation_ids: ['ins_1'],
        };
        const mismatch = executionContextFromClientToken(claims, 'req_1', { installationId: 'ins_2' });
        expect('error' in mismatch).toBe(true);
        const match = executionContextFromClientToken(claims, 'req_1', { installationId: 'ins_1' });
        expect('error' in match).toBe(false);
    });

    it('prefixed IDs round-trip', () => {
        expect(dePrefixId('ten_abc123')).toBe('abc123');
        expect(dePrefixId('abc123')).toBe('abc123');
        expect(withPrefix('ten', 'abc123')).toBe('ten_abc123');
        expect(withPrefix('ten', 'ten_abc123')).toBe('ten_abc123');
    });
});

describe('client-token scope (tenant → user → installation)', () => {
    const scope = { tenantId: 'tenant-a', externalUserId: 'u1', installationIds: ['ins_1'], permissions: ['sessions:create', 'sessions:turn'] };

    it('denies another user session in the same tenant', () => {
        expect(
            denyOnScopeMismatch({ project_id: 'p', tenant_id: 'tenant-a', external_user_id: 'u2' }, 'p', scope),
        ).toBe('user');
    });

    it('denies sessions outside the granted installations', () => {
        expect(
            denyOnScopeMismatch({ project_id: 'p', tenant_id: 'tenant-a', external_user_id: 'u1', installation_id: 'ins_9' }, 'p', scope),
        ).toBe('installation');
    });

    it('allows own scoped session', () => {
        expect(
            denyOnScopeMismatch({ project_id: 'p', tenant_id: 'tenant-a', external_user_id: 'u1', installation_id: 'ins_1' }, 'p', scope),
        ).toBeNull();
    });

    it('grandfathers pre-scope sessions (null user/installation)', () => {
        expect(
            denyOnScopeMismatch({ project_id: 'p', tenant_id: 'tenant-a', external_user_id: null, installation_id: null }, 'p', scope),
        ).toBeNull();
    });

    it('matches prefixed public IDs against raw UUID scope', () => {
        const scope = { tenantId: 'tenant-a', externalUserId: 'u1', installationIds: ['ins_abc123'] };
        // Session rows carry raw UUIDs; tokens may carry either form.
        expect(
            denyOnScopeMismatch({ project_id: 'p', tenant_id: 'tenant-a', external_user_id: 'u1', installation_id: 'abc123' }, 'p', scope),
        ).toBeNull();
    });

    it('enforces minted permissions', () => {
        expect(hasClientPermission(scope, 'sessions:create')).toBe(true);
        expect(hasClientPermission(scope, 'sessions:turn')).toBe(true);
        expect(hasClientPermission(scope, 'tenants:create')).toBe(false);
        expect(hasClientPermission({ tenantId: 't', externalUserId: 'u' }, 'sessions:turn')).toBe(false);
        // Secret-key callers bypass permission checks.
        expect(hasClientPermission(null, 'anything')).toBe(true);
    });
});
