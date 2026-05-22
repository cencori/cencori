/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';

const mockTriggerSecurityWebhook = vi.fn();

vi.mock('@/lib/webhooks', () => ({
    triggerSecurityWebhook: (...args: unknown[]) => mockTriggerSecurityWebhook(...args),
    triggerFallbackWebhook: vi.fn(),
}));

vi.mock('@/lib/supabaseAdmin', () => ({
    createAdminClient: vi.fn(),
}));

import { runGatewayInputPipeline } from '@/lib/gateway/input-guard';
import { JAILBREAK_USER_MESSAGE, toUnifiedMessages } from '@/lib/gateway/__tests__/fixtures';
import { createMockSupabaseForSecurity } from '@/lib/gateway/__tests__/mock-supabase';

describe('Gateway input pipeline webhooks', () => {
    it('fires triggerSecurityWebhook on jailbreak block', async () => {
        const supabase = createMockSupabaseForSecurity({ tier: 'pro' });
        const messages = toUnifiedMessages([{ role: 'user', content: JAILBREAK_USER_MESSAGE }]);

        const result = await runGatewayInputPipeline({
            supabase: supabase as never,
            projectId: 'proj-webhook',
            apiKeyId: 'key-wh',
            environment: 'staging',
            tier: 'pro',
            messages,
            endUserId: 'end-user-42',
        });

        expect(result.ok).toBe(false);
        expect(mockTriggerSecurityWebhook).toHaveBeenCalledWith(
            'proj-webhook',
            expect.objectContaining({
                incident_type: expect.any(String),
                severity: expect.stringMatching(/critical|high/),
                end_user_id: 'end-user-42',
            })
        );
    });
});
