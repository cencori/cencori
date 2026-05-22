/**
 * @vitest-environment node
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
    MASK_TARGET,
    REDACT_TARGET,
    TOKENIZE_TARGET,
    toUnifiedMessages,
} from '@/lib/gateway/__tests__/fixtures';
import { createMockSupabaseForSecurity } from '@/lib/gateway/__tests__/mock-supabase';

describe('Gateway custom rule actions (mask / redact / tokenize)', () => {
    it('masks matched content without blocking', async () => {
        const supabase = createMockSupabaseForSecurity({
            tier: 'pro',
            customRules: [
                {
                    id: 'mask-1',
                    project_id: 'proj-1',
                    name: 'mask-confidential',
                    pattern: MASK_TARGET,
                    match_type: 'keywords',
                    action: 'mask',
                    priority: 10,
                    is_active: true,
                },
            ],
        });
        const original = `Please handle ${MASK_TARGET} in the ticket.`;
        const messages = toUnifiedMessages([{ role: 'user', content: original }]);

        const result = await runGatewayInputPipeline({
            supabase: supabase as never,
            projectId: 'proj-1',
            tier: 'pro',
            messages,
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.messages[0].content).not.toContain(MASK_TARGET);
            expect(result.messages[0].content).toMatch(/\*+/);
        }
    });

    it('redacts matched content without blocking', async () => {
        const supabase = createMockSupabaseForSecurity({
            tier: 'pro',
            customRules: [
                {
                    id: 'redact-1',
                    project_id: 'proj-1',
                    name: 'redact-sensitive',
                    pattern: REDACT_TARGET,
                    match_type: 'keywords',
                    action: 'redact',
                    priority: 10,
                    is_active: true,
                },
            ],
        });
        const messages = toUnifiedMessages([
            { role: 'user', content: `Value is ${REDACT_TARGET} please store.` },
        ]);

        const result = await runGatewayInputPipeline({
            supabase: supabase as never,
            projectId: 'proj-1',
            tier: 'pro',
            messages,
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.messages[0].content).toContain('[REDACTED]');
            expect(result.messages[0].content).not.toContain(REDACT_TARGET);
        }
    });

    it('tokenizes matched content and returns tokenMap', async () => {
        const supabase = createMockSupabaseForSecurity({
            tier: 'pro',
            customRules: [
                {
                    id: 'tok-1',
                    project_id: 'proj-1',
                    name: 'Email Addresses',
                    pattern: TOKENIZE_TARGET,
                    match_type: 'keywords',
                    action: 'tokenize',
                    priority: 10,
                    is_active: true,
                },
            ],
        });
        const messages = toUnifiedMessages([
            { role: 'user', content: `Contact ${TOKENIZE_TARGET} for access.` },
        ]);

        const result = await runGatewayInputPipeline({
            supabase: supabase as never,
            projectId: 'proj-1',
            tier: 'pro',
            messages,
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.messages[0].content).not.toContain(TOKENIZE_TARGET);
            expect(result.messages[0].content).toMatch(/\[[A-Z_]+\d+\]/);
            expect(result.tokenMap?.size).toBeGreaterThan(0);
        }
    });
});
