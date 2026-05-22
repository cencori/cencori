/**
 * @vitest-environment node
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockTriggerSecurityWebhook = vi.fn();

vi.mock('@/lib/webhooks', () => ({
    triggerSecurityWebhook: (...args: unknown[]) => mockTriggerSecurityWebhook(...args),
    triggerFallbackWebhook: vi.fn(),
}));

import { runGatewayOutputGuard } from '@/lib/gateway/output-guard';
import { checkInputSecurity } from '@/lib/safety/multi-layer-check';
import {
    ALLOWED_USER_MESSAGE,
    HARMFUL_AI_RESPONSE,
    toUnifiedMessages,
} from '@/lib/gateway/__tests__/fixtures';
import { createMockSupabaseForSecurity } from '@/lib/gateway/__tests__/mock-supabase';

describe('Gateway output pipeline contract', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('allows benign assistant output', async () => {
        const supabase = createMockSupabaseForSecurity({ tier: 'pro' });
        const inputSecurity = checkInputSecurity(ALLOWED_USER_MESSAGE);

        const result = await runGatewayOutputGuard({
            supabase: supabase as never,
            projectId: 'proj-1',
            outputText: 'Rate limiting protects your API from abuse and cost spikes.',
            inputText: ALLOWED_USER_MESSAGE,
            inputSecurity,
            conversationHistory: toUnifiedMessages([{ role: 'user', content: ALLOWED_USER_MESSAGE }]),
        });

        expect(result.ok).toBe(true);
        expect(mockTriggerSecurityWebhook).not.toHaveBeenCalled();
    });

    it('blocks PII leakage in output and fires security webhook', async () => {
        const supabase = createMockSupabaseForSecurity({ tier: 'pro' });
        const inputSecurity = checkInputSecurity(ALLOWED_USER_MESSAGE);

        const result = await runGatewayOutputGuard({
            supabase: supabase as never,
            projectId: 'proj-out',
            apiKeyId: 'key-1',
            environment: 'production',
            outputText: HARMFUL_AI_RESPONSE,
            inputText: ALLOWED_USER_MESSAGE,
            inputSecurity,
            conversationHistory: toUnifiedMessages([{ role: 'user', content: ALLOWED_USER_MESSAGE }]),
            endUserId: 'eu-1',
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.status).toBe(403);
            expect(result.code).toBe('output_security_violation');
            expect(result.reasons?.length).toBeGreaterThan(0);
        }
        expect(mockTriggerSecurityWebhook).toHaveBeenCalledWith(
            'proj-out',
            expect.objectContaining({
                incident_type: 'output_leakage',
                severity: 'critical',
            })
        );
    });
});
