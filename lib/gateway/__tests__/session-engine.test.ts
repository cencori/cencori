import { beforeEach, describe, it, expect, vi } from 'vitest';
import { NextResponse } from 'next/server';

// Mock modules that trigger the supabase chain import
vi.mock('@/lib/gateway/chat-executor', () => ({
    streamGatewayChat: vi.fn(),
}));
vi.mock('@/lib/gateway/providers-setup', () => ({
    resolveGatewayProvider: vi.fn(),
}));
vi.mock('@/lib/gateway/v1-responses-tools', () => ({
    preProcessBuiltInTools: vi.fn(),
}));
vi.mock('@/lib/embedded/webhook-tools', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/embedded/webhook-tools')>()),
    executeWebhookTool: vi.fn(),
}));
vi.mock('@/lib/governance/record-session', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/governance/record-session')>()),
    recordSessionApprovalRequested: vi.fn(async () => {}),
}));
vi.mock('@/lib/governance/policy-enforcement', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/governance/policy-enforcement')>()),
    orgHasOutputPolicies: vi.fn().mockResolvedValue(false),
}));

import {
    expireStaleSessions,
    maybeCreateCheckpoint,
    buildOutput,
    resumeSessionTurn,
    executeSessionTurn,
} from '../session-engine';

import * as chatExecutor from '@/lib/gateway/chat-executor';
import * as providersSetup from '@/lib/gateway/providers-setup';
import * as responsesTools from '@/lib/gateway/v1-responses-tools';
import * as policyEnforcement from '@/lib/governance/policy-enforcement';
import * as webhookToolsModule from '@/lib/embedded/webhook-tools';
import * as recordSession from '@/lib/governance/record-session';
import { agentToolset } from '@/lib/embedded/agent-tools';

const mockStreamGatewayChat = vi.mocked(chatExecutor.streamGatewayChat);
const mockResolveGatewayProvider = vi.mocked(providersSetup.resolveGatewayProvider);
const mockPreProcessBuiltInTools = vi.mocked(responsesTools.preProcessBuiltInTools);
const mockOrgHasOutputPolicies = vi.mocked(policyEnforcement.orgHasOutputPolicies);
const mockExecuteWebhookTool = vi.mocked(webhookToolsModule.executeWebhookTool);

function makeProvider() {
    return {
        countTokens: vi.fn().mockResolvedValue(10),
        getPricing: vi.fn().mockResolvedValue({ inputPer1KTokens: 0.01, outputPer1KTokens: 0.03, cencoriMarkupPercentage: 50 }),
    };
}

function makeStreamChunks(chunks: Array<Record<string, unknown>>) {
    return async function* () {
        for (const c of chunks) yield c;
    };
}

function makeGateways() {
    return {
        supabase: {
            from: vi.fn(() => ({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                in: vi.fn().mockReturnThis(),
                insert: vi.fn().mockResolvedValue({ error: null }),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
                lt: vi.fn().mockReturnThis(),
                update: vi.fn().mockReturnThis(),
                rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
            rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
        gatewayCtx: {
            projectId: 'proj_1',
            apiKeyId: 'key_1',
            organizationId: 'org_1',
            requestId: 'req_1',
            environment: 'test',
            tier: 'free',
            clientIp: '127.0.0.1',
            countryCode: 'US',
            endUserBillingEnabled: false,
        },
        logSuccess: vi.fn(),
        incrementUsage: vi.fn(),
    };
}

describe('executeSessionTurn', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolveGatewayProvider.mockResolvedValue({
            model: 'gpt-4o',
            actualModel: 'gpt-4o',
            actualProvider: 'openai',
            customProviderTag: undefined,
            provider: makeProvider(),
        });
        mockPreProcessBuiltInTools.mockResolvedValue({ systemContext: '', toolOutputs: [] });
        mockOrgHasOutputPolicies.mockResolvedValue(false);
    });

    it('should complete a turn with text output and emit SSE events', async () => {
        mockStreamGatewayChat.mockImplementation(makeStreamChunks([
            { delta: 'Hello ', actualModel: 'gpt-4o', actualProvider: 'openai' },
            { delta: 'world', actualModel: 'gpt-4o', actualProvider: 'openai' },
            { finishReason: 'stop', actualModel: 'gpt-4o', actualProvider: 'openai' },
        ]));

        const { supabase, gatewayCtx, logSuccess, incrementUsage } = makeGateways();
        const result = await executeSessionTurn({
            supabase: supabase as never,
            gatewayCtx: gatewayCtx as never,
            sessionId: 'sid_1',
            turnNumber: 1,
            model: 'gpt-4o',
            inputMessages: [{ role: 'user', content: 'hello' }],
            inputText: 'hello',
            pauseOnToolCalls: false,
            endUserId: null,
            tier: 'free' as never,
            logSuccess,
            incrementUsage,
        });

        expect(result.ok).toBe(true);
        const response = (result as { ok: true; response: NextResponse }).response;
        expect(response.status).toBe(200);

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let allData = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            allData += decoder.decode(value, { stream: true });
        }

        expect(allData).toContain('event: turn.started');
        expect(allData).toContain('event: output_text.delta');
        expect(allData).toContain('event: turn.completed');
        // No output policy can change the reply, so it streams as written:
        // live deltas that add up to the whole reply, sent once each.
        const deltas = [...allData.matchAll(/event: output_text\.delta\ndata: (.+)/g)].map((m) => JSON.parse(m[1]).delta);
        expect(deltas.length).toBeGreaterThan(1);
        expect(deltas.join('')).toBe('Hello world');
        // Stored once, whole, so history and replay are unchanged.
        const inserts = (supabase.from as ReturnType<typeof vi.fn>).mock.results
            .flatMap((r) => (r.value.insert as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]));
        const storedDeltas = inserts.filter((row) => row.event_type === 'output_text.delta');
        expect(storedDeltas).toHaveLength(1);
        expect(storedDeltas[0].payload).toEqual({ delta: 'Hello world' });
        expect(allData).not.toContain('turn.paused');
        expect(allData).not.toContain('turn.failed');
    });

    it('runs webhook tools on the server and continues the reply', async () => {
        const rounds = [
            [
                { toolCalls: [{ id: 'call_1', function: { name: 'book_meeting', arguments: '{"time":"3pm"}' } }], usage: { promptTokens: 40, completionTokens: 5, totalTokens: 45 }, actualModel: 'gpt-4o', actualProvider: 'openai' },
                { finishReason: 'tool_calls', actualModel: 'gpt-4o', actualProvider: 'openai' },
            ],
            [
                { delta: 'Booked ', actualModel: 'gpt-4o', actualProvider: 'openai' },
                { delta: 'for 3pm.', usage: { promptTokens: 60, completionTokens: 4, totalTokens: 64 }, actualModel: 'gpt-4o', actualProvider: 'openai' },
                { finishReason: 'stop', actualModel: 'gpt-4o', actualProvider: 'openai' },
            ],
        ];
        let call = 0;
        mockStreamGatewayChat.mockImplementation((() => makeStreamChunks(rounds[call++])()) as never);
        mockExecuteWebhookTool.mockResolvedValue({ ok: true, status: 200, output: '{"confirmed":true}' });

        const { supabase, gatewayCtx, logSuccess, incrementUsage } = makeGateways();
        const webhook = { name: 'book_meeting', description: 'Book a meeting', method: 'POST' as const, url: 'https://example.com/book', headers: [], parameters: [{ name: 'time', type: 'string' as const, description: '', required: true }] };
        const result = await executeSessionTurn({
            supabase: supabase as never,
            gatewayCtx: gatewayCtx as never,
            sessionId: 'sid_1',
            turnNumber: 1,
            model: 'gpt-4o',
            tools: webhookToolsModule.webhookToolDefinitions([webhook]) as never,
            agentTools: { toolset: agentToolset({ webhook_tools: [webhook] }), agentId: 'agent_1' },
            inputMessages: [{ role: 'user', content: 'Book me at 3pm' }],
            inputText: 'Book me at 3pm',
            pauseOnToolCalls: false,
            endUserId: null,
            tier: 'free' as never,
            logSuccess,
            incrementUsage,
        });
        const allData = await (result as { ok: true; response: NextResponse }).response.text();

        expect(mockExecuteWebhookTool).toHaveBeenCalledWith(webhook, '{"time":"3pm"}', { organizationId: 'org_1' });
        expect(allData).toContain('event: tool_call.started');
        expect(allData).toContain('event: tool_call.completed');
        const deltas = [...allData.matchAll(/event: output_text\.delta\ndata: (.+)/g)].map((m) => JSON.parse(m[1]).delta);
        expect(deltas.join('')).toBe('Booked for 3pm.');
        expect(allData).toContain('event: turn.completed');
        // The second model call sees the tool's result.
        const second = mockStreamGatewayChat.mock.calls[1][0] as { request: { messages: Array<{ role: string; content: string }> } };
        expect(second.request.messages.at(-1)).toMatchObject({ role: 'tool', content: '{"confirmed":true}' });
        // One log row and one charge for the whole reply, both rounds included.
        expect(logSuccess).toHaveBeenCalledTimes(1);
        expect(logSuccess.mock.calls[0][0]).toMatchObject({ promptTokens: 100, completionTokens: 9 });
        expect(incrementUsage).toHaveBeenCalledTimes(1);
    });

    it('closes the session when the agent ends the conversation', async () => {
        const rounds = [
            [
                { toolCalls: [{ id: 'call_end', function: { name: 'end_conversation', arguments: '{"reason":"done"}' } }], actualModel: 'gpt-4o', actualProvider: 'openai' },
                { finishReason: 'tool_calls', actualModel: 'gpt-4o', actualProvider: 'openai' },
            ],
            [
                { delta: 'Goodbye!', actualModel: 'gpt-4o', actualProvider: 'openai' },
                { finishReason: 'stop', actualModel: 'gpt-4o', actualProvider: 'openai' },
            ],
        ];
        let call = 0;
        mockStreamGatewayChat.mockImplementation((() => makeStreamChunks(rounds[call++])()) as never);
        const toolset = agentToolset({ system_tools: { end_conversation: true } });

        const { supabase, gatewayCtx, logSuccess, incrementUsage } = makeGateways();
        const result = await executeSessionTurn({
            supabase: supabase as never,
            gatewayCtx: gatewayCtx as never,
            sessionId: 'sid_1',
            turnNumber: 1,
            model: 'gpt-4o',
            tools: toolset.definitions as never,
            agentTools: { toolset, agentId: 'agent_1' },
            inputMessages: [{ role: 'user', content: 'thanks, bye' }],
            inputText: 'thanks, bye',
            pauseOnToolCalls: false,
            endUserId: null,
            tier: 'free' as never,
            logSuccess,
            incrementUsage,
        });
        const allData = await (result as { ok: true; response: NextResponse }).response.text();

        expect(allData).toContain('"conversation_ended":true');
        // The goodbye round is offered no tools, so the agent can't loop.
        const second = mockStreamGatewayChat.mock.calls[1][0] as { request: { tools?: unknown } };
        expect(second.request.tools).toBeUndefined();
        const finalize = (supabase.rpc as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[0] === 'finalize_session_turn' && (c[1] as { p_event_type: string }).p_event_type === 'turn.completed');
        expect((finalize?.[1] as { p_status: string }).p_status).toBe('completed');
    });

    it('buffers the whole reply when an output policy could block or redact it', async () => {
        mockOrgHasOutputPolicies.mockResolvedValue(true);
        mockStreamGatewayChat.mockImplementation(makeStreamChunks([
            { delta: 'Hello ', actualModel: 'gpt-4o', actualProvider: 'openai' },
            { delta: 'world', actualModel: 'gpt-4o', actualProvider: 'openai' },
            { finishReason: 'stop', actualModel: 'gpt-4o', actualProvider: 'openai' },
        ]));

        const { supabase, gatewayCtx, logSuccess, incrementUsage } = makeGateways();
        const result = await executeSessionTurn({
            supabase: supabase as never,
            gatewayCtx: gatewayCtx as never,
            sessionId: 'sid_1',
            turnNumber: 1,
            model: 'gpt-4o',
            inputMessages: [{ role: 'user', content: 'hello' }],
            inputText: 'hello',
            pauseOnToolCalls: false,
            endUserId: null,
            tier: 'free' as never,
            logSuccess,
            incrementUsage,
        });
        const response = (result as { ok: true; response: NextResponse }).response;
        const allData = await response.text();
        const deltas = [...allData.matchAll(/event: output_text\.delta\ndata: (.+)/g)].map((m) => JSON.parse(m[1]).delta);
        expect(deltas).toEqual(['Hello world']);
    });

    it('should pause on tool calls when pauseOnToolCalls is true', async () => {
        mockStreamGatewayChat.mockImplementation(makeStreamChunks([
            { delta: 'Let me check', actualModel: 'gpt-4o', actualProvider: 'openai' },
            {
                toolCalls: [{ id: 'tc_1', function: { name: 'get_weather', arguments: '{"city":"NYC"}' } }],
                finishReason: 'tool_calls',
                actualModel: 'gpt-4o', actualProvider: 'openai',
            },
        ]));

        const { supabase, gatewayCtx, logSuccess, incrementUsage } = makeGateways();
        const result = await executeSessionTurn({
            supabase: supabase as never,
            gatewayCtx: gatewayCtx as never,
            sessionId: 'sid_1',
            turnNumber: 1,
            model: 'gpt-4o',
            inputMessages: [{ role: 'user', content: 'weather?' }],
            inputText: 'weather?',
            pauseOnToolCalls: true,
            endUserId: null,
            tier: 'free' as never,
            logSuccess,
            incrementUsage,
            tools: [{ type: 'function' as const, function: { name: 'get_weather', description: '', parameters: {} } }],
        });

        expect(result.ok).toBe(true);
        const reader = ((result as { ok: true; response: NextResponse }).response.body!).getReader();
        const decoder = new TextDecoder();
        let allData = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            allData += decoder.decode(value, { stream: true });
        }

        expect(allData).toContain('event: turn.paused');
        expect(allData).toContain('"tool":"get_weather"');
        expect(allData).not.toContain('event: turn.completed');
        // Running your own tools is not a human approval: nothing for the ledger.
        expect(vi.mocked(recordSession.recordSessionApprovalRequested)).not.toHaveBeenCalled();
    });

    it('should pause only on tools with needsApproval when set', async () => {
        mockStreamGatewayChat.mockImplementation(makeStreamChunks([
            { delta: 'Checking...', actualModel: 'gpt-4o', actualProvider: 'openai' },
            {
                toolCalls: [
                    { id: 'tc_1', function: { name: 'get_weather', arguments: '{"city":"NYC"}' } },
                    { id: 'tc_2', function: { name: 'send_email', arguments: '{"to":"a@b.com"}' } },
                ],
                finishReason: 'tool_calls',
                actualModel: 'gpt-4o', actualProvider: 'openai',
            },
        ]));

        const { supabase, gatewayCtx, logSuccess, incrementUsage } = makeGateways();
        const result = await executeSessionTurn({
            supabase: supabase as never,
            gatewayCtx: gatewayCtx as never,
            sessionId: 'sid_1',
            turnNumber: 1,
            model: 'gpt-4o',
            inputMessages: [{ role: 'user', content: 'check weather and email' }],
            inputText: 'check weather and email',
            pauseOnToolCalls: true,
            endUserId: null,
            tier: 'free' as never,
            logSuccess,
            incrementUsage,
            tools: [
                { type: 'function' as const, function: { name: 'get_weather', description: '', parameters: {} } },
                { type: 'function' as const, function: { name: 'send_email', description: '', parameters: {} }, needsApproval: true },
            ],
        });

        expect(result.ok).toBe(true);
        const reader = ((result as { ok: true; response: NextResponse }).response.body!).getReader();
        const decoder = new TextDecoder();
        let allData = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            allData += decoder.decode(value, { stream: true });
        }

        // send_email has needsApproval and was called: a human must rule.
        expect(allData).toContain('event: turn.paused');
        expect(allData).toContain('"reason":"approval_required"');
        expect(allData).toContain('"tool":"get_weather"'); // first tool in callValues
        expect(allData).toContain('"action_id":"tc_2","tool":"send_email","arguments":"{\\"to\\":\\"a@b.com\\"}","needs_approval":true');
        expect(allData).toContain('"action_id":"tc_1","tool":"get_weather","arguments":"{\\"city\\":\\"NYC\\"}","needs_approval":false');
        // Only the approval call is recorded as a human approval request.
        expect(vi.mocked(recordSession.recordSessionApprovalRequested)).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ tool: 'send_email', actionIds: ['tc_2'] }),
        );
    });

    it('should NOT pause when no tool has needsApproval and none were called', async () => {
        mockStreamGatewayChat.mockImplementation(makeStreamChunks([
            { delta: 'No tools needed', actualModel: 'gpt-4o', actualProvider: 'openai' },
            { finishReason: 'stop', actualModel: 'gpt-4o', actualProvider: 'openai' },
        ]));

        const { supabase, gatewayCtx, logSuccess, incrementUsage } = makeGateways();
        const result = await executeSessionTurn({
            supabase: supabase as never,
            gatewayCtx: gatewayCtx as never,
            sessionId: 'sid_1',
            turnNumber: 1,
            model: 'gpt-4o',
            inputMessages: [{ role: 'user', content: 'hi' }],
            inputText: 'hi',
            pauseOnToolCalls: true,
            endUserId: null,
            tier: 'free' as never,
            logSuccess,
            incrementUsage,
            tools: [
                { type: 'function' as const, function: { name: 'get_weather', description: '', parameters: {} }, needsApproval: true },
            ],
        });

        expect(result.ok).toBe(true);
        const reader = ((result as { ok: true; response: NextResponse }).response.body!).getReader();
        const decoder = new TextDecoder();
        let allData = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            allData += decoder.decode(value, { stream: true });
        }

        expect(allData).toContain('event: turn.completed');
        expect(allData).not.toContain('event: turn.paused');
    });

    it('pauses for tool results (not approval) when only tools without needsApproval are called', async () => {
        mockStreamGatewayChat.mockImplementation(makeStreamChunks([
            { delta: 'Fetching...', actualModel: 'gpt-4o', actualProvider: 'openai' },
            {
                toolCalls: [{ id: 'tc_1', function: { name: 'get_weather', arguments: '{"city":"NYC"}' } }],
                finishReason: 'tool_calls',
                actualModel: 'gpt-4o', actualProvider: 'openai',
            },
        ]));

        const { supabase, gatewayCtx, logSuccess, incrementUsage } = makeGateways();
        const result = await executeSessionTurn({
            supabase: supabase as never,
            gatewayCtx: gatewayCtx as never,
            sessionId: 'sid_1',
            turnNumber: 1,
            model: 'gpt-4o',
            inputMessages: [{ role: 'user', content: 'weather?' }],
            inputText: 'weather?',
            pauseOnToolCalls: true,
            endUserId: null,
            tier: 'free' as never,
            logSuccess,
            incrementUsage,
            tools: [
                { type: 'function' as const, function: { name: 'run_sql', description: '', parameters: {} }, needsApproval: true },
                { type: 'function' as const, function: { name: 'get_weather', description: '', parameters: {} } },
            ],
        });

        expect(result.ok).toBe(true);
        const reader = ((result as { ok: true; response: NextResponse }).response.body!).getReader();
        const decoder = new TextDecoder();
        let allData = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            allData += decoder.decode(value, { stream: true });
        }

        // get_weather has no needsApproval: the caller still has to run it, so the
        // turn pauses for its result, but no human approval is involved.
        expect(allData).toContain('event: turn.paused');
        expect(allData).toContain('"reason":"tool_results_required"');
        expect(allData).toContain('"needs_approval":false');
        expect(allData).not.toContain('event: turn.completed');
    });

    it('should emit turn.failed on execution error', async () => {
        mockStreamGatewayChat.mockImplementation(async function* () {
            yield { delta: 'Hello ', actualModel: 'gpt-4o', actualProvider: 'openai' };
            throw new Error('Stream crashed');
        });

        const { supabase, gatewayCtx, logSuccess, incrementUsage } = makeGateways();
        const result = await executeSessionTurn({
            supabase: supabase as never,
            gatewayCtx: gatewayCtx as never,
            sessionId: 'sid_1',
            turnNumber: 1,
            model: 'gpt-4o',
            inputMessages: [{ role: 'user', content: 'hello' }],
            inputText: 'hello',
            pauseOnToolCalls: false,
            endUserId: null,
            tier: 'free' as never,
            logSuccess,
            incrementUsage,
        });

        expect(result.ok).toBe(true);

        const reader = ((result as { ok: true; response: NextResponse }).response.body!).getReader();
        const decoder = new TextDecoder();
        let allData = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            allData += decoder.decode(value, { stream: true });
        }

        expect(allData).toContain('event: turn.started');
        expect(allData).toContain('event: turn.failed');
        expect(allData).toContain('Stream crashed');
        expect(allData).not.toContain('event: turn.completed');
    });

    it('should return 500 when resolveGatewayProvider throws', async () => {
        mockResolveGatewayProvider.mockRejectedValue(new Error('No provider found'));

        const { supabase, gatewayCtx, logSuccess, incrementUsage } = makeGateways();
        const result = await executeSessionTurn({
            supabase: supabase as never,
            gatewayCtx: gatewayCtx as never,
            sessionId: 'sid_1',
            turnNumber: 1,
            model: 'gpt-4o',
            inputMessages: [{ role: 'user', content: 'hello' }],
            inputText: 'hello',
            pauseOnToolCalls: false,
            endUserId: null,
            tier: 'free' as never,
            logSuccess,
            incrementUsage,
        });

        expect(result.ok).toBe(false);
        expect((result as never as { status: number }).status).toBe(500);
        expect((result as never as { body: Record<string, unknown> }).body).toHaveProperty('error');
    });

    it('should not pause when pauseOnToolCalls is false regardless of needsApproval', async () => {
        mockStreamGatewayChat.mockImplementation(makeStreamChunks([
            { delta: 'Running...', actualModel: 'gpt-4o', actualProvider: 'openai' },
            {
                toolCalls: [{ id: 'tc_1', function: { name: 'send_email', arguments: '{"to":"a@b.com"}' } }],
                finishReason: 'tool_calls',
                actualModel: 'gpt-4o', actualProvider: 'openai',
            },
        ]));

        const { supabase, gatewayCtx, logSuccess, incrementUsage } = makeGateways();
        const result = await executeSessionTurn({
            supabase: supabase as never,
            gatewayCtx: gatewayCtx as never,
            sessionId: 'sid_1',
            turnNumber: 1,
            model: 'gpt-4o',
            inputMessages: [{ role: 'user', content: 'send email' }],
            inputText: 'send email',
            pauseOnToolCalls: false,
            endUserId: null,
            tier: 'free' as never,
            logSuccess,
            incrementUsage,
            tools: [
                { type: 'function' as const, function: { name: 'send_email', description: '', parameters: {} }, needsApproval: true },
            ],
        });

        expect(result.ok).toBe(true);
        const reader = ((result as { ok: true; response: NextResponse }).response.body!).getReader();
        const decoder = new TextDecoder();
        let allData = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            allData += decoder.decode(value, { stream: true });
        }

        expect(allData).toContain('event: turn.completed');
        expect(allData).not.toContain('event: turn.paused');
    });
});

describe('expireStaleSessions', () => {
    it('should call update with paused sessions past their expires_at', async () => {
        const mockUpdate = vi.fn().mockReturnThis();
        const mockEq = vi.fn().mockReturnThis();
        const mockLt = vi.fn().mockResolvedValue({ data: null, error: null });

        const supabase = {
            from: vi.fn(() => ({
                update: mockUpdate,
                eq: mockEq,
                lt: mockLt,
            })),
        };

        await expireStaleSessions(supabase as never);

        expect(supabase.from).toHaveBeenCalledWith('sessions');
        expect(mockUpdate).toHaveBeenCalledWith({ status: 'completed', expires_at: null });
        expect(mockEq).toHaveBeenCalledWith('status', 'paused');
        expect(mockLt).toHaveBeenCalledWith('expires_at', expect.any(String));
    });

    it('should handle DB errors gracefully', async () => {
        const supabase = {
            from: vi.fn(() => {
                throw new Error('DB connection failed');
            }),
        };

        await expect(expireStaleSessions(supabase as never)).rejects.toThrow(
            'Failed to expire stale sessions: DB connection failed'
        );
    });
});

describe('buildOutput', () => {
    it('should produce output array with text and tool calls', async () => {
        const result = buildOutput(
            'Hello world',
            [{ id: 'tc_1', name: 'get_weather', args: '{"city":"NYC"}' }],
            [{ id: 'builtin_1', type: 'web_search', status: 'completed', output: { results: [] } }],
        );

        expect(result).toHaveProperty('output');
        expect(Array.isArray(result.output)).toBe(true);
        expect(result.output).toHaveLength(3);

        const messages = result.output as Array<Record<string, unknown>>;
        const textMsg = messages.find(m => m.type === 'message');
        const funcCall = messages.find(m => m.type === 'function_call');
        const builtin = messages.find(m => m.type === 'web_search');

        expect(textMsg).toBeDefined();
        expect(textMsg).toHaveProperty('content');
        expect(funcCall?.name).toBe('get_weather');
        expect(builtin?.status).toBe('completed');
    });

    it('should handle empty text and no tool calls', async () => {
        const result = buildOutput('', [], []);

        expect(result).toHaveProperty('output');
        expect((result.output as Array<unknown>)).toHaveLength(0);
    });
});

describe('maybeCreateCheckpoint', () => {
    it('should skip when turnNumber is not a multiple of 50', async () => {
        const supabase = { from: vi.fn() };
        await maybeCreateCheckpoint(supabase as never, 'sid', 23, [], '');
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it('should create checkpoint at turn 50', async () => {
        const mockInsert = vi.fn().mockResolvedValue({ error: null });
        const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        const mockLimit = vi.fn().mockReturnValue({ single: mockSingle });
        const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
        const mockLt = vi.fn().mockReturnValue({ order: mockOrder });
        const mockEq2 = vi.fn().mockReturnValue({ lt: mockLt });
        const mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'session_events') {
                    return {
                        select: mockSelect,
                        insert: mockInsert,
                    };
                }
                return {};
            }),
        };

        await maybeCreateCheckpoint(supabase as never, 'sid', 50, [{ role: 'user', content: 'hello' }], 'Hi there');

        expect(mockInsert).toHaveBeenCalled();
        const insertArg = mockInsert.mock.calls[0][0];
        expect(insertArg.event_type).toBe('turn.checkpoint');
        expect(insertArg.turn_number).toBe(50);
        expect(insertArg.payload.messages).toHaveLength(2);
        expect(insertArg.payload.messages[0]).toEqual({ role: 'user', content: 'hello' });
        expect(insertArg.payload.messages[1]).toEqual({ role: 'assistant', content: 'Hi there' });
    });

    it('should merge with previous checkpoint messages', async () => {
        const prevMessages = [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'What is the weather?' },
            { role: 'assistant', content: 'Let me check.' },
        ];

        const mockSingle = vi.fn().mockResolvedValue({
            data: { payload: { turn_number: 50, messages: prevMessages } },
            error: null,
        });
        const mockLimit = vi.fn().mockReturnValue({ single: mockSingle });
        const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
        const mockLt = vi.fn().mockReturnValue({ order: mockOrder });
        const mockEq2 = vi.fn().mockReturnValue({ lt: mockLt });
        const mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        const mockInsert = vi.fn().mockResolvedValue({ error: null });
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'session_events') {
                    return {
                        select: mockSelect,
                        insert: mockInsert,
                    };
                }
                return {};
            }),
        };

        await maybeCreateCheckpoint(
            supabase as never, 'sid', 100,
            [{ role: 'user', content: 'Thanks!' }],
            'You are welcome!',
        );

        expect(mockInsert).toHaveBeenCalled();
        const insertArg = mockInsert.mock.calls[0][0];
        expect(insertArg.payload.messages).toEqual([
            ...prevMessages,
            { role: 'user', content: 'Thanks!' },
            { role: 'assistant', content: 'You are welcome!' },
        ]);
    });

    it('should handle DB errors gracefully', async () => {
        const supabase = {
            from: vi.fn(() => {
                throw new Error('Insert failed');
            }),
        };

        await expect(maybeCreateCheckpoint(supabase as never, 'sid', 50, [], '')).resolves.toBeUndefined();
    });
});

describe('resumeSessionTurn validations', () => {
    it('should reject when no events exist for turn', async () => {
        const supabase = {
            from: vi.fn(() => ({
                select: () => ({
                    eq: () => ({
                        eq: () => ({
                            order: () => ({
                                data: null as Array<Record<string, unknown>> | null,
                                error: null,
                            }),
                        }),
                    }),
                }),
            })),
        };

        const result = await resumeSessionTurn({
            supabase: supabase as never,
            gatewayCtx: {} as never,
            sessionId: 'sid',
            turnNumber: 1,
            toolResults: [{ action_id: 'act_1', output: 'result' }],
            tier: 'free' as never,
            logSuccess: () => {},
            incrementUsage: () => {},
        });

        expect(result.ok).toBe(false);
        expect(result.status).toBe(400);
    });

    it('should reject when no started event exists', async () => {
        const supabase = {
            from: vi.fn(() => ({
                select: () => ({
                    eq: () => ({
                        eq: () => ({
                            order: () => ({
                                data: [
                                    { event_type: 'output_text.delta', payload: { delta: 'hello' }, sequence: 1 },
                                ],
                                error: null,
                            }),
                        }),
                    }),
                }),
            })),
        };

        const result = await resumeSessionTurn({
            supabase: supabase as never,
            gatewayCtx: {} as never,
            sessionId: 'sid',
            turnNumber: 1,
            toolResults: [{ action_id: 'act_1', output: 'result' }],
            tier: 'free' as never,
            logSuccess: () => {},
            incrementUsage: () => {},
        });

        expect(result.ok).toBe(false);
        expect(result.status).toBe(400);
    });

    it('should reject when no paused event exists', async () => {
        const supabase = {
            from: vi.fn(() => ({
                select: () => ({
                    eq: () => ({
                        eq: () => ({
                            order: () => ({
                                data: [
                                    { event_type: 'turn.started', payload: { model: 'gpt-4o', input_text: 'hello' }, sequence: 1 },
                                ],
                                error: null,
                            }),
                        }),
                    }),
                }),
            })),
        };

        const result = await resumeSessionTurn({
            supabase: supabase as never,
            gatewayCtx: {} as never,
            sessionId: 'sid',
            turnNumber: 1,
            toolResults: [{ action_id: 'act_1', output: 'result' }],
            tier: 'free' as never,
            logSuccess: () => {},
            incrementUsage: () => {},
        });

        expect(result.ok).toBe(false);
        expect(result.status).toBe(400);
    });
});

describe('resumeSessionTurn continuation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolveGatewayProvider.mockResolvedValue({
            model: 'gpt-4o',
            actualModel: 'gpt-4o',
            actualProvider: 'openai',
            customProviderTag: undefined,
            provider: makeProvider(),
        });
        mockOrgHasOutputPolicies.mockResolvedValue(false);
    });

    const lookupOrder = { type: 'function', function: { name: 'lookup_order', description: '', parameters: {} } };
    const checkShipment = { type: 'function', function: { name: 'check_shipment', description: '', parameters: {} } };

    /** A session whose turn 1 paused on lookup_order, with the turn's tools stored. */
    function pausedSession() {
        const events = [
            { event_type: 'turn.started', sequence: 1, payload: {
                model: 'gpt-4o', instructions: 'Be brief.', input_text: 'Where is order 1042?',
                input_messages: [
                    { role: 'system', content: 'Be brief.' },
                    { role: 'user', content: 'Where is order 1042?' },
                ],
                function_tools: [lookupOrder, checkShipment],
                pause_on_tool_calls: true,
                metadata: { sdk: 'cencori/agents', agent: 'Support' },
            } },
            { event_type: 'tool_call.started', sequence: 2, payload: { tool: 'lookup_order', arguments: { id: '1042' }, action_id: 'call_1' } },
            { event_type: 'turn.paused', sequence: 3, payload: {
                reason: 'tool_results_required', action_id: 'call_1', tool: 'lookup_order',
                actions: [{ action_id: 'call_1', tool: 'lookup_order', arguments: '{"id":"1042"}', needs_approval: false }],
            } },
        ];
        const inserts: Array<Record<string, unknown>> = [];
        const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
        const supabase = {
            from: vi.fn(() => {
                const chain: Record<string, unknown> = {};
                chain.select = () => chain;
                chain.eq = () => chain;
                chain.order = () => Promise.resolve({ data: events, error: null });
                chain.insert = (row: Record<string, unknown>) => { inserts.push(row); return Promise.resolve({ error: null }); };
                return chain;
            }),
            rpc,
        };
        return { supabase, inserts, rpc };
    }

    async function readAll(response: NextResponse) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let all = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            all += decoder.decode(value, { stream: true });
        }
        return all;
    }

    it('gives the model its tools again, so a second tool round pauses again', async () => {
        mockStreamGatewayChat.mockImplementation(makeStreamChunks([
            {
                toolCalls: [{ id: 'call_2', function: { name: 'check_shipment', arguments: '{"order":"1042"}' } }],
                finishReason: 'tool_calls', actualModel: 'gpt-4o', actualProvider: 'openai',
            },
        ]));
        const { supabase, inserts, rpc } = pausedSession();

        const result = await resumeSessionTurn({
            supabase: supabase as never,
            gatewayCtx: makeGateways().gatewayCtx as never,
            sessionId: 'sid', turnNumber: 1,
            toolResults: [{ action_id: 'call_1', output: '{"status":"shipped"}' }],
            tier: 'free' as never, logSuccess: () => {}, incrementUsage: () => {},
        });
        expect(result.ok).toBe(true);
        const all = await readAll((result as { ok: true; response: NextResponse }).response);

        // The model was called with the stored tools and the full tool-call history.
        const request = mockStreamGatewayChat.mock.calls[0][0].request as { tools?: Array<{ function: { name: string } }>; messages: Array<Record<string, unknown>> };
        expect(request.tools?.map(t => t.function.name)).toEqual(['lookup_order', 'check_shipment']);
        expect(request.messages.at(-2)).toMatchObject({ role: 'assistant', tool_calls: [{ id: 'call_1' }] });
        expect(request.messages.at(-1)).toMatchObject({ role: 'tool', toolCallId: 'call_1', content: '{"status":"shipped"}' });

        // The caller sees the resume, then a second pause for check_shipment.
        expect(all).toContain('event: turn.resumed');
        expect(all).not.toContain('event: turn.started');
        expect(all).toContain('event: turn.paused');
        expect(all).toContain('"tool":"check_shipment"');

        // Recorded as turn 2: a turn.started that can be resumed again, without
        // input_text (history must not repeat the user's message)...
        const started = inserts.find(r => r.event_type === 'turn.started');
        expect(started).toMatchObject({ turn_number: 2 });
        const payload = started!.payload as Record<string, unknown>;
        expect(payload.input_text).toBeUndefined();
        expect(payload.original_input_text).toBe('Where is order 1042?');
        expect(payload.resumed_from_turn).toBe(1);
        expect(payload.pause_on_tool_calls).toBe(true);
        expect(payload.metadata).toEqual({ sdk: 'cencori/agents', agent: 'Support' }); // carried over
        // The pause records what the trace needs: the request, the model, cost and timing.
        const pausedCall = rpc.mock.calls.find((c) => c[1]?.p_event_type === 'turn.paused')!;
        expect(pausedCall[1].p_payload.trace).toMatchObject({ request_id: 'req_1', model: 'gpt-4o', provider: 'openai', used_fallback: false, rounds: 1 });
        expect(typeof pausedCall[1].p_payload.trace.ttft_ms).toBe('number');
        expect((payload.input_messages as Array<Record<string, unknown>>).at(-1)).toMatchObject({ role: 'tool', toolCallId: 'call_1' });
        // ...and the pause finalized on turn 2.
        expect(rpc).toHaveBeenCalledWith('finalize_session_turn', expect.objectContaining({
            p_turn_number: 2, p_event_type: 'turn.paused', p_status: 'paused',
        }));
    });

    it('continues under the next agent on a handoff (instructions, model and tools)', async () => {
        mockStreamGatewayChat.mockImplementation(makeStreamChunks([
            { delta: 'Billing here.', actualModel: 'claude-sonnet-4-5', actualProvider: 'anthropic' },
            { finishReason: 'stop', actualModel: 'claude-sonnet-4-5', actualProvider: 'anthropic' },
        ]));
        const { supabase, inserts } = pausedSession();
        const refund = { type: 'function' as const, function: { name: 'issue_refund', description: '', parameters: {} }, needsApproval: true };

        const result = await resumeSessionTurn({
            supabase: supabase as never,
            gatewayCtx: makeGateways().gatewayCtx as never,
            sessionId: 'sid', turnNumber: 1,
            toolResults: [{ action_id: 'call_1', output: 'Transferred to Billing.' }],
            tier: 'free' as never, logSuccess: () => {}, incrementUsage: () => {},
            override: { instructions: 'You handle billing.', model: 'claude-sonnet-4-5', tools: [refund], metadata: { agent: 'Billing' } },
        });
        await readAll((result as { ok: true; response: NextResponse }).response);

        expect(mockResolveGatewayProvider).toHaveBeenCalledWith(expect.objectContaining({ requestedModel: 'claude-sonnet-4-5', pinnedConnectionId: null }));
        const request = mockStreamGatewayChat.mock.calls[0][0].request as { tools?: Array<{ function: { name: string } }>; messages: Array<Record<string, unknown>> };
        expect(request.tools?.map(t => t.function.name)).toEqual(['issue_refund']);
        expect(request.messages[0]).toEqual({ role: 'system', content: 'You handle billing.' });
        expect(request.messages.some(m => m.content === 'Be brief.')).toBe(false);
        // The next resume continues as Billing.
        const started = inserts.find(r => r.event_type === 'turn.started')!.payload as Record<string, unknown>;
        expect(started.instructions).toBe('You handle billing.');
        expect(started.metadata).toEqual({ sdk: 'cencori/agents', agent: 'Billing' });
        expect((started.function_tools as Array<{ function: { name: string } }>).map(t => t.function.name)).toEqual(['issue_refund']);
    });

    it('lets a structured-output turn still call its tools (tool_choice required, not the schema tool)', async () => {
        mockStreamGatewayChat.mockImplementation(makeStreamChunks([
            { delta: 'ok', actualModel: 'gpt-4o', actualProvider: 'openai' },
            { finishReason: 'stop', actualModel: 'gpt-4o', actualProvider: 'openai' },
        ]));
        const { supabase, gatewayCtx, logSuccess, incrementUsage } = makeGateways();
        const result = await executeSessionTurn({
            supabase: supabase as never, gatewayCtx: gatewayCtx as never,
            sessionId: 'sid_1', turnNumber: 1, model: 'gpt-4o',
            inputMessages: [{ role: 'user', content: 'order 1042?' }], inputText: 'order 1042?',
            pauseOnToolCalls: true, endUserId: null, tier: 'free' as never, logSuccess, incrementUsage,
            tools: [lookupOrder as never],
            response_format: { type: 'json_schema', json_schema: { name: 'final_output', schema: { type: 'object' } } },
        });
        await readAll((result as { ok: true; response: NextResponse }).response);
        expect(mockStreamGatewayChat.mock.calls[0][0].request.toolChoice).toBe('required');
    });

    it('completes normally when the model answers after the tool results', async () => {
        mockStreamGatewayChat.mockImplementation(makeStreamChunks([
            { delta: 'Order 1042 has shipped.', actualModel: 'gpt-4o', actualProvider: 'openai' },
            { finishReason: 'stop', actualModel: 'gpt-4o', actualProvider: 'openai' },
        ]));
        const { supabase, rpc } = pausedSession();

        const result = await resumeSessionTurn({
            supabase: supabase as never,
            gatewayCtx: makeGateways().gatewayCtx as never,
            sessionId: 'sid', turnNumber: 1,
            toolResults: [{ action_id: 'call_1', output: '{"status":"shipped"}' }],
            tier: 'free' as never, logSuccess: () => {}, incrementUsage: () => {},
        });
        const all = await readAll((result as { ok: true; response: NextResponse }).response);
        expect(all).toContain('Order 1042 has shipped.');
        expect(all).toContain('event: turn.completed');
        expect(rpc).toHaveBeenCalledWith('finalize_session_turn', expect.objectContaining({
            p_turn_number: 2, p_event_type: 'turn.completed', p_status: 'active',
        }));
    });
});
