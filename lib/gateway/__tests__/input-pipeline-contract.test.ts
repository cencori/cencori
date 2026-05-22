/**
 * @vitest-environment node
 *
 * Contract: both gateway routes depend on runGatewayInputPipeline.
 * Same fixtures must produce the same allow/block decisions.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/webhooks', () => ({
    triggerSecurityWebhook: vi.fn(),
    triggerFallbackWebhook: vi.fn(),
}));

vi.mock('@/lib/supabaseAdmin', () => ({
    createAdminClient: vi.fn(),
}));

import { runGatewayInputPipeline } from '@/lib/gateway/input-guard';
import {
    ALLOWED_USER_MESSAGE,
    JAILBREAK_USER_MESSAGE,
    toUnifiedMessages,
} from '@/lib/gateway/__tests__/fixtures';
import { createMockSupabaseForSecurity } from '@/lib/gateway/__tests__/mock-supabase';

describe('Gateway input pipeline contract', () => {
    it('allows benign prompts on Pro tier', async () => {
        const supabase = createMockSupabaseForSecurity({ tier: 'pro' });
        const messages = toUnifiedMessages([{ role: 'user', content: ALLOWED_USER_MESSAGE }]);

        const result = await runGatewayInputPipeline({
            supabase: supabase as never,
            projectId: 'proj-1',
            tier: 'pro',
            messages,
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.messages).toEqual(messages);
            expect(result.inputSecurity.safe).toBe(true);
        }
    });

    it('blocks jailbreak prompts on Pro tier', async () => {
        const supabase = createMockSupabaseForSecurity({ tier: 'pro' });
        const messages = toUnifiedMessages([{ role: 'user', content: JAILBREAK_USER_MESSAGE }]);

        const result = await runGatewayInputPipeline({
            supabase: supabase as never,
            projectId: 'proj-1',
            tier: 'pro',
            messages,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.status).toBe(403);
            expect(result.code).toBe('security_violation');
        }
    });

    it('allows benign prompts on Free tier (paid security features off)', async () => {
        const supabase = createMockSupabaseForSecurity({ tier: 'free' });
        const messages = toUnifiedMessages([{ role: 'user', content: ALLOWED_USER_MESSAGE }]);

        const result = await runGatewayInputPipeline({
            supabase: supabase as never,
            projectId: 'proj-1',
            tier: 'free',
            messages,
        });

        expect(result.ok).toBe(true);
    });

    it('blocks when custom data rule matches', async () => {
        const supabase = createMockSupabaseForSecurity({
            tier: 'pro',
            customRules: [
                {
                    id: 'rule-1',
                    project_id: 'proj-1',
                    name: 'block-secret',
                    pattern: 'SECRET_TOKEN_123',
                    match_type: 'keywords',
                    action: 'block',
                    priority: 10,
                    is_active: true,
                },
            ],
        });
        const messages = toUnifiedMessages([
            { role: 'user', content: 'Please process SECRET_TOKEN_123 now' },
        ]);

        const result = await runGatewayInputPipeline({
            supabase: supabase as never,
            projectId: 'proj-1',
            tier: 'pro',
            messages,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.code).toBe('data_rule_block');
            expect(result.status).toBe(403);
        }
    });

    it('same fixture: Pro block decision is identical across two invocations (route parity baseline)', async () => {
        const supabase = createMockSupabaseForSecurity({ tier: 'pro' });
        const messages = toUnifiedMessages([{ role: 'user', content: JAILBREAK_USER_MESSAGE }]);
        const params = {
            supabase: supabase as never,
            projectId: 'proj-parity',
            apiKeyId: 'key-1',
            environment: 'production',
            tier: 'pro' as const,
            messages,
        };

        const first = await runGatewayInputPipeline(params);
        const second = await runGatewayInputPipeline(params);

        expect(first.ok).toBe(second.ok);
        if (!first.ok && !second.ok) {
            expect(first.status).toBe(second.status);
            expect(first.code).toBe(second.code);
        }
    });
});
