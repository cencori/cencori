/**
 * @vitest-environment node
 *
 * Responses `custom` tools (Codex's apply_patch) on providers that only take function tools.
 * They used to be dropped before the provider saw them, so agents on Claude, Maximo, GLM and
 * DeepSeek could not edit files with the tool built for it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockExecuteGatewayChat = vi.fn();

vi.mock('@/lib/gateway/chat-executor', () => ({
    executeGatewayChat: (...args: unknown[]) => mockExecuteGatewayChat(...args),
    streamGatewayChat: vi.fn(),
}));

vi.mock('@/lib/gateway/providers-setup', () => ({
    resolveGatewayProvider: vi.fn().mockResolvedValue({
        providerName: 'anthropic',
        model: 'claude-opus-5-5',
        provider: { supportsTools: true },
        billingMode: 'standard',
    }),
}));

vi.mock('@/lib/gateway/output-guard', () => ({
    runGatewayOutputGuard: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('@/lib/supabaseAdmin', () => ({ createAdminClient: vi.fn() }));

import {
    customToolAsFunction,
    customToolInput,
    translateCustomTools,
} from '@/lib/gateway/responses-custom-tools';
import { translateResponsesInputItems } from '@/lib/gateway/responses-translate';
import { runV1ResponsesExecution } from '@/lib/gateway/v1-responses-execute';
import { createMockGatewayContext, toUnifiedMessages } from '@/lib/gateway/__tests__/fixtures';
import type { SecurityCheckResult } from '@/lib/safety/multi-layer-check';

const applyPatch = {
    type: 'custom',
    name: 'apply_patch',
    description: 'The `apply_patch` tool can be used to edit files. This is a FREEFORM tool, so do not wrap the patch in JSON.',
    format: { type: 'grammar', syntax: 'lark', definition: 'start: begin_patch hunk+ end_patch' },
};

const execCommand = {
    type: 'function',
    function: { name: 'exec_command', parameters: { type: 'object', properties: { cmd: { type: 'string' } } } },
};

const patch = '*** Begin Patch\n*** Add File: a.txt\n+hello\n*** End Patch\n';

describe('customToolAsFunction', () => {
    it('offers the tool as a function taking the raw text in `input`, with its grammar', () => {
        const tool = customToolAsFunction(applyPatch as never);
        expect(tool.function.name).toBe('apply_patch');
        expect(tool.function.parameters).toMatchObject({ required: ['input'] });
        expect(tool.function.description).toContain('start: begin_patch hunk+ end_patch');
        expect(tool.function.description).toContain('`input`');
    });
});

describe('translateCustomTools', () => {
    it('translates custom tools, keeps function tools, and remembers which were custom', () => {
        const { tools, customToolNames } = translateCustomTools([execCommand, applyPatch]);
        expect(tools?.[0]).toBe(execCommand);
        expect((tools?.[1] as { type: string }).type).toBe('function');
        expect([...customToolNames]).toEqual(['apply_patch']);
    });
});

describe('customToolInput', () => {
    it('reads the text from `input`, and tolerates a model that ignored the schema', () => {
        expect(customToolInput(JSON.stringify({ input: patch }))).toBe(patch);
        expect(customToolInput(JSON.stringify({ patch }))).toBe(patch);
        expect(customToolInput(patch)).toBe(patch);
    });
});

describe('custom tool history', () => {
    it('replays a custom call and its output as one paired chat tool turn', () => {
        const { messages, dropped } = translateResponsesInputItems([
            { type: 'message', role: 'user', content: 'add a.txt' },
            { type: 'custom_tool_call', call_id: 'call_1', name: 'apply_patch', input: patch },
            { type: 'custom_tool_call_output', call_id: 'call_1', output: 'Success. Updated the following files:\nA a.txt' },
        ]);
        expect(dropped).toEqual([]);
        expect(messages[1]).toMatchObject({
            role: 'assistant',
            tool_calls: [{ id: 'call_1', function: { name: 'apply_patch', arguments: JSON.stringify({ input: patch }) } }],
        });
        expect(messages[2]).toMatchObject({ role: 'tool', toolCallId: 'call_1' });
    });
});

describe('a call to a custom tool', () => {
    const inputSecurity: SecurityCheckResult = { safe: true, reasons: [], layer: 'input', riskScore: 0, confidence: 1 };

    beforeEach(() => vi.clearAllMocks());

    it('reaches the provider as a function tool and returns to the client as a custom_tool_call', async () => {
        mockExecuteGatewayChat.mockResolvedValue({
            content: '',
            model: 'claude-opus-5-5',
            provider: 'anthropic',
            usage: { promptTokens: 9, completionTokens: 9, totalTokens: 18 },
            cost: { providerCostUsd: 0, cencoriChargeUsd: 0, markupPercentage: 0 },
            latencyMs: 1,
            finishReason: 'tool_calls',
            toolCalls: [{ id: 'call_9', type: 'function', function: { name: 'apply_patch', arguments: JSON.stringify({ input: patch }) } }],
            actualProvider: 'anthropic',
            actualModel: 'claude-opus-5-5',
            usedFallback: false,
            originalProvider: 'anthropic',
            originalModel: 'claude-opus-5-5',
            billingMode: 'standard',
        });

        const result = await runV1ResponsesExecution({
            supabase: {} as never,
            gatewayCtx: createMockGatewayContext(),
            model: 'claude-opus-5-5',
            body: { model: 'claude-opus-5-5', input: 'add a.txt', stream: false, store: false, tools: [execCommand, applyPatch] },
            messages: toUnifiedMessages([{ role: 'user', content: 'add a.txt' }]),
            inputText: 'add a.txt',
            inputSecurity,
            endUserId: null,
            endUserQuota: null,
            tier: 'free' as const,
            recordEndUserUsage: vi.fn(),
            logSuccess: vi.fn(),
            incrementUsage: vi.fn(),
        } as never);
        if (!result.ok) throw new Error('expected ok');

        const sentTools = mockExecuteGatewayChat.mock.calls[0][0].request.tools as Array<{ type: string; function: { name: string } }>;
        expect(sentTools.map((t) => `${t.type}:${t.function.name}`)).toEqual(['function:exec_command', 'function:apply_patch']);

        const json = await result.response.json() as { output: Array<Record<string, unknown>> };
        expect(json.output).toEqual([
            expect.objectContaining({ type: 'custom_tool_call', call_id: 'call_9', name: 'apply_patch', input: patch }),
        ]);
    });
});
