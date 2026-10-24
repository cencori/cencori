import { afterEach, describe, expect, it, vi } from 'vitest';
import { isGovernanceEnabled } from '@/lib/governance/flag';
import { enforcePolicies, orgHasOutputPolicies } from '@/lib/governance/policy-enforcement';
import { recordGatewayGovernanceDecision } from '@/lib/governance/record-decision';
import { recordSessionApprovalRequested } from '@/lib/governance/record-session';

vi.mock('@/lib/governance/delivery', () => ({ deliverAuditEntry: vi.fn() }));
vi.mock('@/lib/governance/policy-store', () => ({ listActivePolicies: vi.fn() }));

import { deliverAuditEntry } from '@/lib/governance/delivery';
import { listActivePolicies } from '@/lib/governance/policy-store';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = {} as any;

describe('GOVERNANCE_ENABLED switch', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.clearAllMocks();
    });

    it('is off unless the env var is exactly "true"', () => {
        vi.stubEnv('GOVERNANCE_ENABLED', '');
        expect(isGovernanceEnabled()).toBe(false);
        vi.stubEnv('GOVERNANCE_ENABLED', '1');
        expect(isGovernanceEnabled()).toBe(false);
        vi.stubEnv('GOVERNANCE_ENABLED', 'true');
        expect(isGovernanceEnabled()).toBe(true);
    });

    it('skips policy loading and ledger writes when off', async () => {
        vi.stubEnv('GOVERNANCE_ENABLED', 'false');

        const enforcement = await enforcePolicies(supabase, { orgId: 'org-1', direction: 'input', content: 'hi' });
        expect(enforcement.decision).toBe('allow');
        expect(await orgHasOutputPolicies(supabase, 'org-1')).toBe(false);
        expect(listActivePolicies).not.toHaveBeenCalled();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await recordGatewayGovernanceDecision({ organizationId: 'org-1' } as any, {} as any);
        await recordSessionApprovalRequested(supabase, { orgId: 'org-1', sessionId: 's-1', turnNumber: 1 });
        expect(deliverAuditEntry).not.toHaveBeenCalled();
    });
});
