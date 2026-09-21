import { describe, expect, it } from 'vitest';
import { mintClientToken, verifyClientToken } from '@/lib/embedded/client-tokens';

describe('embedded client tokens', () => {
    it('mints and verifies a scoped token', () => {
        const { token } = mintClientToken({
            projectId: 'proj_123',
            environment: 'production',
            tenantId: 'tenant-uuid-1',
            externalUserId: 'employee_456',
            installationIds: ['ins_789'],
            permissions: ['sessions:create', 'sessions:turn'],
            expiresInSeconds: 900,
        });
        expect(token.startsWith('ect_')).toBe(true);
        const verified = verifyClientToken(token);
        expect(verified.ok).toBe(true);
        if (verified.ok) {
            expect(verified.claims.project_id).toBe('proj_123');
            expect(verified.claims.tenant_id).toBe('tenant-uuid-1');
            expect(verified.claims.external_user_id).toBe('employee_456');
        }
    });

    it('rejects tampered tokens', () => {
        const { token } = mintClientToken({
            projectId: 'proj_123',
            environment: 'production',
            tenantId: 't1',
            externalUserId: 'u1',
            permissions: ['sessions:create'],
        });
        const tampered = `${token.slice(0, -2)}xx`;
        const result = verifyClientToken(tampered);
        expect(result.ok).toBe(false);
    });

    it('rejects non-ect tokens', () => {
        const result = verifyClientToken('csk_test_abc');
        expect(result.ok).toBe(false);
    });

    it('caps expiry at 15 minutes', () => {
        const before = Math.floor(Date.now() / 1000);
        const { token } = mintClientToken({
            projectId: 'p',
            environment: 'test',
            tenantId: 't',
            externalUserId: 'u',
            permissions: [],
            expiresInSeconds: 3600,
        });
        const verified = verifyClientToken(token);
        expect(verified.ok).toBe(true);
        if (verified.ok) {
            expect(verified.claims.exp - before).toBeLessThanOrEqual(900);
        }
    });
});
