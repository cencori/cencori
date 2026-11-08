import { NextResponse } from 'next/server';
import type { createAdminClient } from '@/lib/supabaseAdmin';
import type { GatewayContext } from '@/lib/gateway-middleware';
import type { SubscriptionTier } from '@/lib/entitlements';
import type { NetworkPolicy } from '@/lib/embedded/net-policy';
import { streamGatewayChat } from '@/lib/gateway/chat-executor';
import {
    resolveGatewayProvider,
    type ResolvedGatewayProvider,
} from '@/lib/gateway/providers-setup';
import {
    preProcessBuiltInTools,
    type ResponsesBuiltInTool,
    type ToolCallOutput,
} from '@/lib/gateway/v1-responses-tools';
import type { ResponsesTool } from '@/lib/gateway/v1-responses-execute';
import {
    type TokenUsage,
    type Tool,
    type UnifiedMessage,
} from '@/lib/providers/base';
import { settleStreamUsage } from '@/lib/gateway/stream-usage';
import type { SessionEventType, SessionEventPayloadMap } from '@/lib/gateway/session-types';
import { applyInstructionsOverride, type ResumeOverride } from '@/lib/gateway/session-resume-override';
import { runGatewayOutputGuard } from '@/lib/gateway/output-guard';
import { orgHasOutputPolicies } from '@/lib/governance/policy-enforcement';
import { WEBHOOK_TOOL_MAX_ITERATIONS } from '@/lib/embedded/webhook-tools';
import type { AgentToolset } from '@/lib/embedded/agent-tools';
import { runGatewayInputPipeline } from '@/lib/gateway/input-guard';
import { recordSessionApprovalRequested } from '@/lib/governance/record-session';
import { applyPolicyRedactions } from '@/lib/governance/policy-enforcement';
import { deTokenize } from '@/lib/safety/custom-data-rules';
import type { SecurityCheckResult } from '@/lib/safety/multi-layer-check';
import { calculateGatewayCharge } from '@/lib/gateway/model-access';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;
export type { SupabaseAdmin };

export type TurnExecuteParams = {
    supabase: SupabaseAdmin;
    gatewayCtx: GatewayContext;
    sessionId: string;
    turnNumber: number;
    model: string;
    instructions?: string;
    tools?: ResponsesTool[];
    /** Effective published-version ∩ installation host policy for built-in Web results. */
    networkPolicy?: NetworkPolicy;
    tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; name: string };
    temperature?: number;
    max_output_tokens?: number;
    response_format?: { type: 'text' } | { type: 'json_object' } | { type: 'json_schema'; json_schema: { name: string; description?: string; schema: Record<string, unknown>; strict?: boolean } };
    inputMessages: UnifiedMessage[];
    inputText: string;
    inputSecurity?: SecurityCheckResult;
    tokenMap?: Map<string, string>;
    pauseOnToolCalls?: boolean;
    endUserId: string | null;
    tier: SubscriptionTier;
    /** Installation-bound knowledge: injected as context, cited on completion. */
    knowledgeContext?: { block: string | null; citations: Array<{ chunk_id: string; source_id: string; ord?: number | null; score: number }> };
    /** Published skill procedures pinned to the installed agent version. */
    skillsBlock?: string | null;
    /** Exact provider-connection pin from the installed manifest. */
    pinnedConnectionId?: string | null;
    /** Reasoning effort from the installed manifest (OpenAI family only). */
    reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
    /**
     * The installed version's own tools (webhook and system): the engine runs
     * them itself and continues the reply. `agentId` and `agentName` go with a
     * hand-off.
     */
    agentTools?: { toolset: AgentToolset; agentId: string; agentName?: string };
    logSuccess: (meta: {
        provider: string; model: string; status: 'success' | 'success_fallback' | 'error';
        promptTokens: number; completionTokens: number; totalTokens: number;
        /** Token buckets — see LogRequestParams. */
        cacheReadTokens?: number; cacheWriteTokens?: number; uncachedPromptTokens?: number;
        providerCostUsd: number; cencoriChargeUsd: number; markupPercentage: number;
        errorMessage?: string;
        /** Assistant text, so the logged turn is inspectable in the console. */
        responseText?: string;
    }) => void;
    incrementUsage: (chargeUsd: number) => void;
    recordEndUserUsage?: (usage: {
        promptTokens: number; completionTokens: number; totalTokens: number;
        providerCostUsd: number; cencoriChargeUsd: number; markupPercentage: number;
    }) => void;
    /**
     * Called once with the assistant's full text after a turn completes
     * successfully (not on pause/failure). The turns route uses this to
     * schedule gateway memory writeback via waitUntil.
     */
    onCompletion?: (fullText: string) => void;
};

export type TurnExecuteResult =
    | { ok: true; response: NextResponse }
    | { ok: false; status: number; body: Record<string, unknown> };

async function appendSessionEvent(
    supabase: SupabaseAdmin, sessionId: string, turnNumber: number,
    sequence: number, eventType: SessionEventType, payload: Record<string, unknown>,
): Promise<void> {
    const result = await supabase.from('session_events').insert({
        session_id: sessionId, turn_number: turnNumber, sequence,
        event_type: eventType, payload,
    });
    if (result?.error) {
        throw new Error(`Failed to append session event ${eventType}: ${result.error.message}`);
    }
}

async function finalizeSessionTurn(
    supabase: SupabaseAdmin,
    projectId: string,
    sessionId: string,
    turnNumber: number,
    sequence: number,
    eventType: 'turn.paused' | 'turn.completed' | 'turn.failed',
    payload: Record<string, unknown>,
    status: 'active' | 'paused' | 'completed' | 'failed',
    costUsd: number,
): Promise<void> {
    const result = await supabase.rpc('finalize_session_turn', {
        p_session_id: sessionId,
        p_project_id: projectId,
        p_turn_number: turnNumber,
        p_sequence: sequence,
        p_event_type: eventType,
        p_payload: payload,
        p_status: status,
        p_cost: costUsd,
    });
    if (result?.error) {
        throw new Error(`Failed to finalize session turn: ${result.error.message}`);
    }
}

export { expireStaleSessions } from './session-expiry';

/**
 * A message as turn.started stores it. Tool-call linkage (the assistant's
 * tool_calls, a tool message's toolCallId) is kept so a resumed turn can be
 * rebuilt and resumed again; a provider rejects tool results it can't match.
 */
type StoredMessage = { role: string; content: UnifiedMessage['content'] | null; tool_calls?: unknown; toolCallId?: string };
function storedMessage(m: UnifiedMessage): StoredMessage {
    const linked = m as UnifiedMessage & { tool_calls?: unknown; toolCallId?: string };
    return {
        role: m.role,
        content: m.content ?? null,
        ...(linked.tool_calls ? { tool_calls: linked.tool_calls } : {}),
        ...(linked.toolCallId ? { toolCallId: linked.toolCallId } : {}),
    };
}

function buildSSE(eventType: string, data: Record<string, unknown>): string {
    return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
}

function extractTools(tools?: ResponsesTool[]) {
    const functionTools: Tool[] = [];
    const builtInTools: ResponsesBuiltInTool[] = [];
    if (!tools) return { functionTools, builtInTools };
    for (const t of tools) {
        if (t.type === 'function') functionTools.push(t as Tool);
        else builtInTools.push(t as ResponsesBuiltInTool);
    }
    return { functionTools, builtInTools };
}

function resolveToolChoice(
    forceSchema: boolean, schemaName: string | null,
    choice?: 'auto' | 'none' | 'required' | { type: 'function'; name: string },
    otherToolCount = 0,
): 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } } | undefined {
    // Structured output with other tools: the model must call a tool each round,
    // either a real one (the turn pauses or runs it) or the schema tool, whose
    // arguments are the final answer. Forcing the schema tool would mean the
    // agent could never use its tools.
    if (forceSchema && schemaName && otherToolCount > 0) return 'required';
    if (forceSchema && schemaName) return { type: 'function', function: { name: schemaName } };
    if (choice === 'none' || choice === 'required') return choice;
    if (choice && typeof choice === 'object' && 'name' in choice) {
        return { type: 'function', function: { name: (choice as { name: string }).name } };
    }
    return undefined;
}

function makeStream(params: {
    supabase: SupabaseAdmin; gatewayCtx: GatewayContext;
    sessionId: string; turnNumber: number;
    resolved: ResolvedGatewayProvider;
    messages: UnifiedMessage[]; functionTools: Tool[];
    forceSchemaResult: boolean; schemaToolName: string | null;
    tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; name: string };
    temperature?: number; max_output_tokens?: number;
    pauseOnToolCalls: boolean;
    needsApprovalToolNames: Set<string>;
    collectedBuiltinToolOutputs: ToolCallOutput[];
    reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
    /** Exact provider-connection pin (frozen into turn.started for resume). */
    pinnedConnectionId?: string | null;
    agentTools?: { toolset: AgentToolset; agentId: string; agentName?: string };
    instructions?: string;
    inputText?: string;
    inputSecurity?: SecurityCheckResult;
    knowledgeContext?: { block: string | null; citations: Array<{ chunk_id: string; source_id: string; ord?: number | null; score: number }> };
    tokenMap?: Map<string, string>;
    endUserId?: string | null;
    tier: SubscriptionTier;
    logSuccess: (m: { provider: string; model: string; status: 'success' | 'success_fallback' | 'error'; promptTokens: number; completionTokens: number; totalTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number; uncachedPromptTokens?: number; providerCostUsd: number; cencoriChargeUsd: number; markupPercentage: number; errorMessage?: string; responseText?: string }) => void;
    incrementUsage: (c: number) => void;
    recordEndUserUsage?: (u: { promptTokens: number; completionTokens: number; totalTokens: number; providerCostUsd: number; cencoriChargeUsd: number; markupPercentage: number }) => void;
    onCompletion?: (fullText: string) => void;
    /**
     * Set when this stream continues a paused turn after its tool results came
     * back (resumeSessionTurn). The continuation is recorded as its own turn:
     * its turn.started carries no input_text, so history doesn't repeat the
     * user's message, and the caller sees turn.resumed instead of turn.started.
     */
    resumed?: { fromTurn: number; toolResultIds: string[]; originalInputText?: string };
}): NextResponse {
    const {
        supabase, gatewayCtx, sessionId, turnNumber, resolved,
        messages, functionTools, forceSchemaResult, schemaToolName, tool_choice,
        temperature, max_output_tokens, pauseOnToolCalls, needsApprovalToolNames, collectedBuiltinToolOutputs,
        instructions, inputText, inputSecurity, tokenMap, endUserId,
        tier, logSuccess, incrementUsage, recordEndUserUsage, onCompletion, knowledgeContext, reasoningEffort,
        pinnedConnectionId, agentTools, resumed,
    } = params;

    // Output can only be blocked or redacted by a governance output policy.
    // Without one, nothing can change the reply after the fact, so its text
    // streams as it's generated; with one, the turn buffers the full reply
    // for the output check as before (shown text can't be redacted).
    const outputPoliciesPromise = orgHasOutputPolicies(supabase, gatewayCtx.organizationId, gatewayCtx.projectId)
        .catch(() => true);

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            let seq = 0;
            let fullText = '';
            // Real usage from the provider when the adapter reports it.
            let reportedUsage: TokenUsage | undefined;
            const toolCalls: Record<string, { id: string; name: string; args: string }> = {};

            // Structured output replaces the text with the schema tool's
            // arguments at the end, so there's no prefix to stream early.
            const streamsLive = !(forceSchemaResult && schemaToolName) && !(await outputPoliciesPromise);
            /** How much raw text has gone out live, and the detokenized text it became. */
            let releasedRawLength = 0;
            let emittedText = '';
            /**
             * Sends approved text the client doesn't have yet, as a true delta. Live
             * deltas aren't stored one by one: the whole reply is stored once at the
             * end, so history and event replay read exactly what they did before.
             */
            const releaseLive = () => {
                let end = fullText.length;
                // Never split a tokenization placeholder ("[EMAIL_1]"): a partial one
                // can't be detokenized and would show the internal marker.
                if (tokenMap && tokenMap.size > 0) {
                    for (const placeholder of tokenMap.keys()) {
                        for (let partial = Math.min(placeholder.length - 1, end); partial > 0; partial--) {
                            if (fullText.slice(0, end).endsWith(placeholder.slice(0, partial))) {
                                end -= partial;
                                break;
                            }
                        }
                    }
                }
                // Nor half of a UTF-16 surrogate pair.
                if (end > 0) {
                    const last = fullText.charCodeAt(end - 1);
                    if (last >= 0xd800 && last <= 0xdbff) end -= 1;
                }
                if (end <= releasedRawLength) return;
                const approved = tokenMap ? deTokenize(fullText.slice(0, end), tokenMap) : fullText.slice(0, end);
                // Detokenizing a longer prefix must not rewrite what's already shown.
                if (!approved.startsWith(emittedText)) return;
                const delta = approved.slice(emittedText.length);
                releasedRawLength = end;
                if (!delta) return;
                emittedText = approved;
                controller.enqueue(encoder.encode(buildSSE('output_text.delta', { delta })));
            };

            const el = async (eventType: SessionEventType, data: SessionEventPayloadMap[typeof eventType]) => {
                seq++;
                await appendSessionEvent(supabase, sessionId, turnNumber, seq, eventType, data as Record<string, unknown>);
                controller.enqueue(encoder.encode(buildSSE(eventType, data as Record<string, unknown>)));
            };
            const terminal = async (
                eventType: 'turn.paused' | 'turn.completed' | 'turn.failed',
                data: Record<string, unknown>,
                status: 'active' | 'paused' | 'completed' | 'failed',
                costUsd: number,
            ) => {
                seq++;
                await finalizeSessionTurn(
                    supabase,
                    gatewayCtx.projectId,
                    sessionId,
                    turnNumber,
                    seq,
                    eventType,
                    data,
                    status,
                    costUsd,
                );
                controller.enqueue(encoder.encode(buildSSE(eventType, data)));
            };

            try {
                const started = {
                    turn_number: turnNumber,
                    model: resolved.model,
                    instructions,
                    // A resumed turn keeps the user's words for the output guard and
                    // the next resume, but not as input_text: history reads that as
                    // a new user message.
                    ...(resumed
                        ? { original_input_text: resumed.originalInputText, resumed_from_turn: resumed.fromTurn }
                        : { input_text: inputText }),
                    input_messages: messages.map(storedMessage),
                    input_security: inputSecurity,
                    input_token_map: tokenMap ? Object.fromEntries(tokenMap) : undefined,
                    // Frozen turn controls so an approved resume runs on the
                    // same key and effort as the paused turn.
                    ...(pinnedConnectionId ? { provider_connection_id: pinnedConnectionId } : {}),
                    ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
                    // ...and with the same tools, so it can call them again and pause again.
                    ...(functionTools.length > 0 ? { function_tools: functionTools } : {}),
                    ...(pauseOnToolCalls ? { pause_on_tool_calls: true } : {}),
                    ...(forceSchemaResult && schemaToolName ? { schema_tool_name: schemaToolName } : {}),
                    ...(tool_choice !== undefined ? { tool_choice } : {}),
                    ...(temperature !== undefined ? { temperature } : {}),
                    ...(max_output_tokens !== undefined ? { max_output_tokens } : {}),
                };
                if (resumed) {
                    // Recorded for the next resume; the caller already knows the turn
                    // is under way and gets turn.resumed, as before.
                    seq++;
                    await appendSessionEvent(supabase, sessionId, turnNumber, seq, 'turn.started', started as Record<string, unknown>);
                    controller.enqueue(encoder.encode(buildSSE('turn.resumed', {
                        action_id: resumed.toolResultIds[0] ?? '',
                        resolution: 'approved',
                        tool_results: resumed.toolResultIds.map((action_id) => ({ action_id })),
                        resumed_from_turn: resumed.fromTurn,
                    })));
                } else {
                    await el('turn.started', started as SessionEventPayloadMap['turn.started']);
                }

                // The agent's own tools run here: when every call the model makes is
                // one, Cencori runs them, records the calls, hands back the results
                // and the reply continues. Usage adds up across rounds and is logged
                // and charged once, at the end.
                let conversation = messages;
                /** Set by end_conversation: the session closes once this reply is done. */
                let conversationEnded = false;
                const prior = { promptTokens: 0, completionTokens: 0, providerCostUsd: 0, cencoriChargeUsd: 0 };
                rounds: for (let round = 0; ; round++) {
                    let roundText = '';
                    let roundStarted = fullText.length;
                    for (const key of Object.keys(toolCalls)) delete toolCalls[key];
                    reportedUsage = undefined;
                    for await (const chunk of streamGatewayChat({
                        supabase, projectId: gatewayCtx.projectId,
                        organizationId: gatewayCtx.organizationId,
                        allowedModels: gatewayCtx.allowedModels, sponsoredModels: gatewayCtx.sponsoredModels, tier,
                        request: {
                            messages: conversation, model: resolved.model,
                            temperature, maxTokens: max_output_tokens, stream: true,
                            // After ending the conversation the agent only says goodbye.
                            tools: functionTools.length > 0 && !conversationEnded ? functionTools : undefined,
                            toolChoice: resolveToolChoice(forceSchemaResult, schemaToolName, tool_choice, functionTools.filter(t => t.function.name !== schemaToolName).length),
                            ...(reasoningEffort ? { reasoningEffort } : {}),
                        },
                        resolved: resolved as never,
                        requestId: gatewayCtx.requestId,
                        })) {
                            if (chunk.usage) {
                                reportedUsage = chunk.usage;
                            }
                            if (chunk.delta) {
                                // A reply that resumes after a tool call starts on its own line.
                                if (fullText.length > 0 && fullText.length === roundStarted && round > 0) {
                                    fullText += '\n\n';
                                    roundStarted = fullText.length;
                                }
                                fullText += chunk.delta;
                                roundText += chunk.delta;
                                if (streamsLive && !chunk.finishReason) releaseLive();
                            }
                        if (chunk.toolCalls) {
                            for (const tc of chunk.toolCalls) {
                                const k = tc.id || 'unknown';
                                if (!toolCalls[k]) toolCalls[k] = { id: k, name: '', args: '' };
                                if (tc.function?.name) toolCalls[k].name = tc.function.name;
                                if (tc.function?.arguments) toolCalls[k].args += tc.function.arguments;
                            }
                        }
                        if (chunk.finishReason) {
                            const requested = Object.values(toolCalls).filter((t) => t.name);
                            if (
                                requested.length > 0
                                && round < WEBHOOK_TOOL_MAX_ITERATIONS
                                && !(forceSchemaResult && schemaToolName)
                                && !!agentTools
                                && requested.every((t) => agentTools.toolset.has(t.name))
                            ) {
                                const streamProvider =
                                    chunk.actualProvider !== resolved.providerName && resolved.router?.hasProvider(chunk.actualProvider)
                                        ? resolved.router.getProvider(chunk.actualProvider)
                                        : resolved.provider;
                                const roundPricing = await streamProvider.getPricing(chunk.actualModel);
                                const roundUsage = await settleStreamUsage({
                                    reported: reportedUsage,
                                    pricing: roundPricing,
                                    estimate: async () => ({
                                        promptTokens: Math.max(1, Math.ceil(conversation.map((m) => m.content || '').join(' ').length / 4)),
                                        completionTokens: Math.max(1, Math.ceil((roundText + requested.map((t) => t.args).join('')).length / 4)),
                                    }),
                                });
                                prior.promptTokens += roundUsage.promptTokens;
                                prior.completionTokens += roundUsage.completionTokens;
                                prior.providerCostUsd += roundUsage.providerCostUsd;
                                prior.cencoriChargeUsd += calculateGatewayCharge(roundUsage.providerCostUsd, roundPricing, chunk.billingMode).cencoriChargeUsd;

                                conversation = [...conversation, {
                                    role: 'assistant',
                                    content: roundText,
                                    tool_calls: requested.map((t) => ({ id: t.id, type: 'function' as const, function: { name: t.name, arguments: t.args } })),
                                }];
                                for (const call of requested) {
                                    // Arguments may carry masked placeholders; the endpoint gets the real values.
                                    const args = tokenMap ? deTokenize(call.args, tokenMap) : call.args;
                                    let parsedArgs: Record<string, unknown> = {};
                                    try { parsedArgs = JSON.parse(args || '{}'); } catch { /* sent as-is below */ }
                                    await el('tool_call.started', { tool: call.name, arguments: parsedArgs, action_id: call.id });
                                    const outcome = await agentTools!.toolset.run({ id: call.id, name: call.name, args }, {
                                        organizationId: gatewayCtx.organizationId,
                                        projectId: gatewayCtx.projectId,
                                        agentId: agentTools!.agentId,
                                        agentName: agentTools!.agentName,
                                        surface: 'conversation',
                                        conversationId: sessionId,
                                        transcript: conversation.map((m) => ({ role: m.role, content: m.content ?? '' })),
                                    });
                                    if (outcome.endsConversation) conversationEnded = true;
                                    await el('tool_call.completed', { tool: call.name, output: { ok: outcome.ok, status: outcome.status ?? null, result: outcome.output }, action_id: call.id });
                                    conversation = [...conversation, { role: 'tool', content: outcome.output, toolCallId: call.id }];
                                }
                                continue rounds;
                            }

                            if (forceSchemaResult && schemaToolName) {
                                const sc = Object.values(toolCalls).find(t => t.name === schemaToolName);
                                if (sc?.args) fullText = sc.args;
                            }

                            const callValues = Object.values(toolCalls).filter(
                                t => !(forceSchemaResult && schemaToolName && t.name === schemaToolName),
                            );

                            fullText = tokenMap ? deTokenize(fullText, tokenMap) : fullText;
                            for (const toolCall of callValues) {
                                if (tokenMap) toolCall.args = deTokenize(toolCall.args, tokenMap);
                            }

                            const safeInputSecurity = inputSecurity ?? {
                                safe: true,
                                reasons: [],
                                layer: 'input',
                                riskScore: 0,
                                confidence: 1,
                            };
                            const outputCheck = await runGatewayOutputGuard({
                                supabase,
                                projectId: gatewayCtx.projectId,
                                apiKeyId: gatewayCtx.apiKeyId,
                                environment: gatewayCtx.environment,
                                outputText: [fullText, ...callValues.map(tc => tc.args)].filter(Boolean).join('\n'),
                                inputText: inputText ?? '',
                                inputSecurity: safeInputSecurity,
                                conversationHistory: messages,
                                endUserId,
                                organizationId: gatewayCtx.organizationId,
                                model: resolved.model,
                                region: gatewayCtx.countryCode,
                            });

                            const streamProvider =
                                chunk.actualProvider !== resolved.providerName
                                && resolved.router?.hasProvider(chunk.actualProvider)
                                    ? resolved.router.getProvider(chunk.actualProvider)
                                    : resolved.provider;
                            const pricing = await streamProvider.getPricing(chunk.actualModel);
                            const settled = await settleStreamUsage({
                                reported: reportedUsage,
                                pricing,
                                estimate: async () => {
                                    const promptText = messages.map(m => m.content || '').join(' ');
                                    try {
                                        return {
                                            promptTokens: await streamProvider.countTokens(promptText, chunk.actualModel),
                                            completionTokens: await streamProvider.countTokens(fullText, chunk.actualModel),
                                        };
                                    } catch {
                                        return {
                                            promptTokens: Math.max(1, Math.ceil(promptText.length / 4)),
                                            completionTokens: Math.max(1, Math.ceil(fullText.length / 4)),
                                        };
                                    }
                                },
                            });
                            // This round plus any tool rounds before it.
                            const pt = settled.promptTokens + prior.promptTokens;
                            const ct = settled.completionTokens + prior.completionTokens;
                            const tt = pt + ct;
                            const pc = settled.providerCostUsd + prior.providerCostUsd;
                            const { cencoriChargeUsd: roundCharge, markupPercentage } = calculateGatewayCharge(
                                settled.providerCostUsd,
                                pricing,
                                chunk.billingMode,
                            );
                            const cc = roundCharge + prior.cencoriChargeUsd;
                            const pn = resolved.customProviderTag || chunk.actualProvider;

                            if (!outputCheck.ok) {
                                await terminal('turn.failed', {
                                    turn_number: turnNumber,
                                    output: { error: outputCheck.message },
                                    usage: { input_tokens: pt, output_tokens: ct, total_tokens: tt },
                                }, 'active', cc);
                                logSuccess({
                                    provider: pn,
                                    model: chunk.actualModel,
                                    status: 'error',
                                    promptTokens: pt,
                                    completionTokens: ct,
                                    totalTokens: tt,
                                    cacheReadTokens: settled.cacheReadTokens,
                                    cacheWriteTokens: settled.cacheWriteTokens,
                                    uncachedPromptTokens: settled.uncachedPromptTokens,
                                    providerCostUsd: pc,
                                    cencoriChargeUsd: cc,
                                    markupPercentage,
                                    errorMessage: outputCheck.message,
                                });
                                incrementUsage(cc);
                                if (recordEndUserUsage) recordEndUserUsage({ promptTokens: pt, completionTokens: ct, totalTokens: tt, providerCostUsd: pc, cencoriChargeUsd: cc, markupPercentage });
                                controller.close();
                                return;
                            }

                            // Apply policy output redactions before the (buffered) emit.
                            if (outputCheck.redactions?.length) {
                                fullText = applyPolicyRedactions(fullText, outputCheck.redactions).text;
                            }

                            if (fullText && emittedText) {
                                // Store the whole reply once for history and replay; send
                                // only what hasn't gone out live.
                                seq++;
                                await appendSessionEvent(supabase, sessionId, turnNumber, seq, 'output_text.delta', { delta: fullText });
                                const remainder = fullText.startsWith(emittedText) ? fullText.slice(emittedText.length) : '';
                                if (remainder) controller.enqueue(encoder.encode(buildSSE('output_text.delta', { delta: remainder })));
                            } else if (fullText) {
                                await el('output_text.delta', { delta: fullText });
                            }

                            for (const tc of callValues) {
                                let args: Record<string, unknown> = {};
                                try { args = JSON.parse(tc.args); } catch {}
                                await el('tool_call.started', { tool: tc.name, arguments: args, action_id: tc.id });
                            }

                            for (const to of collectedBuiltinToolOutputs) {
                                await el('tool_call.completed', {
                                    tool: to.type, output: to.output || to.error || {}, action_id: to.id,
                                });
                            }

                            // Pause on client tool calls when the caller asked to. Every call
                            // pauses: the caller has to run it and send its result back, so a
                            // turn never completes with calls nobody executed. The reason tells
                            // the caller which kind of pause this is: a human must rule on a
                            // needsApproval tool (approval_required), or the caller just runs
                            // its own tools (tool_results_required). Only the first is a human
                            // approval, so only it reaches the governance ledger.
                            if (pauseOnToolCalls && callValues.length > 0) {
                                const approvalCalls = callValues.filter(tc => needsApprovalToolNames.has(tc.name));
                                const needsHuman = approvalCalls.length > 0;
                                await terminal('turn.paused', {
                                    reason: needsHuman ? 'approval_required' : 'tool_results_required',
                                    action_id: callValues[0].id,
                                    tool: callValues[0].name,
                                    arguments: Object.fromEntries(callValues.map(tc => [tc.name, tc.args])),
                                    actions: callValues.map(tc => ({
                                        action_id: tc.id,
                                        tool: tc.name,
                                        arguments: tc.args,
                                        needs_approval: needsApprovalToolNames.has(tc.name),
                                    })),
                                }, 'paused', cc);
                                // Governance: an autonomous tool call is now gated on human approval.
                                if (needsHuman) {
                                    void recordSessionApprovalRequested(supabase, {
                                        orgId: gatewayCtx.organizationId,
                                        projectId: gatewayCtx.projectId,
                                        sessionId,
                                        turnNumber,
                                        tool: approvalCalls[0].name,
                                        actionIds: approvalCalls.map(tc => tc.id),
                                        model: resolved.model,
                                    });
                                }
                                logSuccess({ provider: pn, model: chunk.actualModel, status: chunk.usedFallback ? 'success_fallback' : 'success', promptTokens: pt, completionTokens: ct, totalTokens: tt, cacheReadTokens: settled.cacheReadTokens, cacheWriteTokens: settled.cacheWriteTokens, uncachedPromptTokens: settled.uncachedPromptTokens, providerCostUsd: pc, cencoriChargeUsd: cc, markupPercentage, responseText: fullText });
                                incrementUsage(cc);
                                if (recordEndUserUsage) recordEndUserUsage({ promptTokens: pt, completionTokens: ct, totalTokens: tt, providerCostUsd: pc, cencoriChargeUsd: cc, markupPercentage });
                                controller.close();
                                return;
                            }

                            // Complete
                            const output = buildOutput(fullText, callValues, collectedBuiltinToolOutputs);
                            await terminal(
                                'turn.completed',
                                {
                                    turn_number: turnNumber,
                                    output,
                                    usage: { input_tokens: pt, output_tokens: ct, total_tokens: tt },
                                    ...(knowledgeContext && knowledgeContext.citations.length > 0
                                        ? { knowledge_citations: knowledgeContext.citations }
                                        : {}),
                                    ...(conversationEnded ? { conversation_ended: true } : {}),
                                },
                                // The agent ended it: the session closes, and the next message starts a new one.
                                conversationEnded ? 'completed' : 'active',
                                cc,
                            );

                            logSuccess({ provider: pn, model: chunk.actualModel, status: chunk.usedFallback ? 'success_fallback' : 'success', promptTokens: pt, completionTokens: ct, totalTokens: tt, cacheReadTokens: settled.cacheReadTokens, cacheWriteTokens: settled.cacheWriteTokens, uncachedPromptTokens: settled.uncachedPromptTokens, providerCostUsd: pc, cencoriChargeUsd: cc, markupPercentage, responseText: fullText });
                            incrementUsage(cc);
                            if (recordEndUserUsage) recordEndUserUsage({ promptTokens: pt, completionTokens: ct, totalTokens: tt, providerCostUsd: pc, cencoriChargeUsd: cc, markupPercentage });

                            void maybeCreateCheckpoint(supabase, sessionId, turnNumber, messages, fullText);

                            // Gateway memory writeback (async, post-redaction) — the
                            // turns route wires this to runChatMemoryWriteback.
                            onCompletion?.(fullText);

                            controller.close();
                        }
                    }
                    break rounds;
                }
            } catch (error) {
                const msg = error instanceof Error ? error.message : 'Turn execution failed';
                try {
                    await terminal(
                        'turn.failed',
                        { turn_number: turnNumber, output: { error: msg }, usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 } },
                        'active',
                        0,
                    );
                } catch (finalizeError) {
                    console.error('[SessionEngine] Failed to persist turn failure:', finalizeError);
                }
                logSuccess({ provider: '', model: '', status: 'error', promptTokens: 0, completionTokens: 0, totalTokens: 0, providerCostUsd: 0, cencoriChargeUsd: 0, markupPercentage: 0, errorMessage: msg });
                controller.close();
            }
        },
    });

    return new NextResponse(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });
}

const SESSION_HISTORY_MAX_MESSAGES = 40;

/**
 * Rebuild prior conversation turns for a session so the model sees
 * history. Reads turn.started (user input) and turn.completed
 * (assistant output) events; the current turn's events are not yet
 * persisted when this runs, so everything returned is prior context.
 */
async function loadSessionHistory(supabase: SupabaseAdmin, sessionId: string): Promise<UnifiedMessage[]> {
    const { data: events, error } = await supabase
        .from('session_events')
        .select('event_type, payload, turn_number, sequence')
        .eq('session_id', sessionId)
        .in('event_type', ['turn.started', 'turn.completed'])
        .order('turn_number', { ascending: true })
        .order('sequence', { ascending: true });
    if (error) throw new Error(`Failed to load session history: ${error.message}`);

    const history: UnifiedMessage[] = [];
    for (const ev of events ?? []) {
        const p = ev.payload as Record<string, unknown>;
        if (ev.event_type === 'turn.started') {
            const text = p.input_text;
            if (typeof text === 'string' && text.length > 0) {
                history.push({ role: 'user', content: text });
            }
            continue;
        }
        const out = p.output as Record<string, unknown> | null | undefined;
        let text = '';
        if (typeof out?.text === 'string') {
            // Resumed turns store output as { text, tool_outputs }
            text = out.text;
        } else if (Array.isArray(out?.output)) {
            for (const item of out.output as Array<Record<string, unknown>>) {
                if (item.type !== 'message' || !Array.isArray(item.content)) continue;
                for (const c of item.content as Array<Record<string, unknown>>) {
                    if (c.type === 'output_text' && typeof c.text === 'string') text = c.text;
                }
            }
        }
        if (text) history.push({ role: 'assistant', content: text });
    }
    return history.slice(-SESSION_HISTORY_MAX_MESSAGES);
}

export async function executeSessionTurn(params: TurnExecuteParams): Promise<TurnExecuteResult> {
    const {
        supabase, gatewayCtx, sessionId, turnNumber, model,
        instructions, tools, tool_choice, temperature, max_output_tokens,
        response_format, inputMessages, inputText, inputSecurity, tokenMap,
        pauseOnToolCalls, tier, logSuccess, incrementUsage, recordEndUserUsage, onCompletion,
        knowledgeContext, skillsBlock, pinnedConnectionId, reasoningEffort,
    } = params;

    try {
        const resolved = await resolveGatewayProvider({
            supabase, projectId: gatewayCtx.projectId, organizationId: gatewayCtx.organizationId, requestedModel: model,
            tensorModelPolicy: gatewayCtx.tensorModelPolicy,
            allowedModels: gatewayCtx.allowedModels, sponsoredModels: gatewayCtx.sponsoredModels,
            pinnedConnectionId: pinnedConnectionId ?? null,
            autoRouterInput: {
                text: [...(inputMessages ?? []).map((m) => m.content ?? ''), inputText ?? ''].join('\n') || null,
                tools: (tools as unknown[] | null) ?? null,
                hasImage: false,
            },
        });

        const { functionTools, builtInTools } = extractTools(tools);
        const needsApprovalToolNames = new Set<string>();
        if (tools) {
            for (const t of tools) {
                if (t.type === 'function' && (t as Tool).needsApproval) {
                    needsApprovalToolNames.add(t.function.name);
                }
            }
        }
        const history = await loadSessionHistory(supabase, sessionId);
        const messages: UnifiedMessage[] = [...history, ...inputMessages];

        const pre = builtInTools.length > 0
            ? await preProcessBuiltInTools(inputText, builtInTools, gatewayCtx.projectId, params.networkPolicy)
            : { systemContext: '', toolOutputs: [] as ToolCallOutput[] };

        if (pre.systemContext) {
            const contextPipeline = await runGatewayInputPipeline({
                supabase,
                projectId: gatewayCtx.projectId,
                apiKeyId: gatewayCtx.apiKeyId,
                environment: gatewayCtx.environment,
                tier,
                messages: [{ role: 'user', content: pre.systemContext }],
                endUserId: params.endUserId,
            });
            if (!contextPipeline.ok) {
                pre.systemContext = '';
                for (const output of pre.toolOutputs) {
                    output.status = 'failed';
                    output.error = 'Retrieved context was blocked by the project security policy';
                    delete output.output;
                }
            } else {
                pre.systemContext = contextPipeline.messages[0]?.content ?? '';
            }
        }

        if (pre.systemContext) {
            const ci = builtInTools.some(t => t.type === 'web_search_preview')
                ? '\n\nWhen citing information from search results, reference them using [N] notation where N is the result number (e.g., [1], [2]).'
                : '';
            messages.unshift({ role: 'system', content: `You have access to the following real-time information. Use it to answer the user's question naturally.${ci}\n\n${pre.systemContext}` });
        }
        if (knowledgeContext?.block) {
            messages.unshift({ role: 'system', content: knowledgeContext.block });
        }
        if (skillsBlock) {
            messages.unshift({ role: 'system', content: skillsBlock });
        }
        if (instructions) messages.unshift({ role: 'system', content: instructions });

        let forceSchema = false;
        let schemaName: string | null = null;
        if (response_format?.type === 'json_schema') {
            schemaName = response_format.json_schema.name || 'structured_output';
            functionTools.push({ type: 'function', function: { name: schemaName, description: response_format.json_schema.description || 'Generate structured output', parameters: response_format.json_schema.schema } });
            forceSchema = true;
        }

        if (functionTools.length > 0 && resolved.provider.supportsTools === false) {
            return {
                ok: false,
                status: 400,
                body: {
                    error: {
                        message: `Tool calling is not implemented for provider '${resolved.providerName}'.`,
                        type: 'invalid_request_error',
                        code: 'tools_not_supported_by_provider',
                    },
                    status: 'failed',
                },
            };
        }

        const response = makeStream({
            supabase, gatewayCtx, sessionId, turnNumber,
            resolved: resolved as never,
            messages, functionTools, forceSchemaResult: forceSchema, schemaToolName: schemaName,
            tool_choice, temperature, max_output_tokens,
            pauseOnToolCalls: pauseOnToolCalls ?? false,
            needsApprovalToolNames,
            collectedBuiltinToolOutputs: [...pre.toolOutputs],
            instructions, inputText, inputSecurity, tokenMap, endUserId: params.endUserId,
            tier, logSuccess, incrementUsage, recordEndUserUsage, onCompletion,
            knowledgeContext,
            reasoningEffort: params.reasoningEffort,
            pinnedConnectionId: params.pinnedConnectionId ?? null,
            agentTools: params.agentTools,
        });

        return { ok: true, response };
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Session engine error';
        return { ok: false, status: 500, body: { error: { message: msg, type: 'invalid_request_error', code: 'session_engine_error' }, status: 'failed' } };
    }
}

export type ResumeTurnParams = {
    supabase: SupabaseAdmin;
    gatewayCtx: GatewayContext;
    sessionId: string;
    turnNumber: number;
    toolResults: Array<{ action_id: string; output: string }>;
    tier: SubscriptionTier;
    logSuccess: TurnExecuteParams['logSuccess'];
    incrementUsage: TurnExecuteParams['incrementUsage'];
    recordEndUserUsage?: TurnExecuteParams['recordEndUserUsage'];
    inputText?: string;
    inputSecurity?: SecurityCheckResult;
    tokenMap?: Map<string, string>;
    /** Continue under another agent configuration (a handoff); see session-resume-override. */
    override?: ResumeOverride;
};

export async function resumeSessionTurn(params: ResumeTurnParams): Promise<TurnExecuteResult> {
    const {
        supabase, gatewayCtx, sessionId, turnNumber, toolResults,
        tier, logSuccess, incrementUsage, recordEndUserUsage,
        inputText: resumedInputText, inputSecurity: resumedInputSecurity,
        tokenMap: resumedTokenMap,
        override,
    } = params;

    try {
        const { data: events } = await supabase
            .from('session_events')
            .select('event_type, payload, sequence')
            .eq('session_id', sessionId)
            .eq('turn_number', turnNumber)
            .order('sequence', { ascending: true });

        if (!events || events.length === 0) {
            return { ok: false, status: 400, body: { error: { message: 'No events found for turn', type: 'invalid_request_error', code: 'no_events' }, status: 'failed' } };
        }

        const startedEvent = events.find(e => e.event_type === 'turn.started');
        if (!startedEvent) {
            return { ok: false, status: 400, body: { error: { message: 'Turn has no started event', type: 'invalid_request_error', code: 'no_started_event' }, status: 'failed' } };
        }

        const pausedEvent = events.find(e => e.event_type === 'turn.paused');
        if (!pausedEvent) {
            return { ok: false, status: 400, body: { error: { message: 'Turn is not paused', type: 'invalid_request_error', code: 'turn_not_paused' }, status: 'failed' } };
        }

        const sp = startedEvent.payload as Record<string, unknown>;
        const storedInstructions = sp.instructions as string | undefined;
        const model = override?.model ?? (sp.model as string);
        const instructions = override?.instructions ?? storedInstructions;
        const inputText = (sp.input_text ?? sp.original_input_text) as string | undefined;
        const storedInputSecurity = sp.input_security as SecurityCheckResult | undefined;
        // Frozen at turn start so the resumed turn runs on the same key/effort.
        // A handoff to another model can't keep the paused turn's provider-connection pin.
        const storedPin = !override?.model && typeof sp.provider_connection_id === 'string' && sp.provider_connection_id
            ? sp.provider_connection_id
            : null;
        const storedEffort = ['low', 'medium', 'high'].includes(sp.reasoning_effort as string)
            ? (sp.reasoning_effort as 'low' | 'medium' | 'high')
            : undefined;
        const storedTokenMap = new Map<string, string>(
            Object.entries((sp.input_token_map as Record<string, string> | undefined) ?? {})
        );
        for (const [placeholder, value] of resumedTokenMap ?? []) {
            storedTokenMap.set(placeholder, value);
        }

        if (!model) {
            return { ok: false, status: 400, body: { error: { message: 'Turn has no model', type: 'invalid_request_error', code: 'no_model' }, status: 'failed' } };
        }

        const resolved = await resolveGatewayProvider({
            supabase, projectId: gatewayCtx.projectId, organizationId: gatewayCtx.organizationId, requestedModel: model,
            tensorModelPolicy: gatewayCtx.tensorModelPolicy,
            allowedModels: gatewayCtx.allowedModels, sponsoredModels: gatewayCtx.sponsoredModels,
            pinnedConnectionId: storedPin,
            // Resume path: the full turn messages are reconstructed after
            // resolution, so classify on the stored input text. A model switch
            // mid-turn is possible if the original classification used richer
            // context, but the BYOK gate (not the exact task pick) is what
            // must stay consistent here.
            autoRouterInput: { text: inputText ?? null, tools: null, hasImage: false },
        });

        // Reconstruct the assistant's text and the paused tool calls. The paused
        // event lists exactly the calls awaiting results; older pauses without
        // that list fall back to the turn's tool_call.started events.
        let assistantText = '';
        let toolCallEntries: Array<{ id: string; name: string; args: string }> = [];
        for (const ev of events) {
            const p = ev.payload as Record<string, unknown>;
            switch (ev.event_type) {
                case 'output_text.delta':
                    assistantText += (p.delta as string) || '';
                    break;
                case 'tool_call.started':
                    toolCallEntries.push({
                        id: (p.action_id as string) || `tc_${toolCallEntries.length}`,
                        name: p.tool as string,
                        args: JSON.stringify(p.arguments || {}),
                    });
                    break;
            }
        }
        const pausedActions = (pausedEvent.payload as Record<string, unknown>).actions;
        if (Array.isArray(pausedActions) && pausedActions.length > 0) {
            toolCallEntries = (pausedActions as Array<{ action_id: string; tool: string; arguments?: unknown }>).map((a) => ({
                id: a.action_id,
                name: a.tool,
                args: typeof a.arguments === 'string' ? a.arguments : JSON.stringify(a.arguments ?? {}),
            }));
        }

        // Restore the turn's messages from turn.started, tool-call linkage included.
        const storedMessages = sp.input_messages as StoredMessage[] | undefined;
        let messages: UnifiedMessage[] = storedMessages && storedMessages.length > 0
            ? storedMessages.map(m => ({
                role: m.role as 'system' | 'user' | 'assistant' | 'tool',
                content: m.content,
                ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
                ...(m.toolCallId ? { toolCallId: m.toolCallId } : {}),
            } as UnifiedMessage))
            : [];
        if (!storedMessages || storedMessages.length === 0) {
            if (instructions) messages.push({ role: 'system', content: instructions } as UnifiedMessage);
            const contextSummary = inputText
                ? `The user asked: "${inputText}".\n\nThe assistant processed this request and called the following functions which have now been approved and executed.`
                : 'The following function calls were approved and executed. Continue the conversation based on their results.';
            messages.push({ role: 'system', content: contextSummary } as UnifiedMessage);
        }

        if (override?.instructions !== undefined && storedMessages && storedMessages.length > 0) {
            messages = applyInstructionsOverride(messages, storedInstructions, override.instructions);
        }

        if (toolCallEntries.length > 0) {
            messages.push({
                role: 'assistant',
                content: assistantText || null,
                tool_calls: toolCallEntries.map(tc => ({
                    id: tc.id,
                    type: 'function' as const,
                    function: { name: tc.name, arguments: tc.args },
                })),
            } as UnifiedMessage as never);
            for (const tc of toolCallEntries) {
                const result = toolResults.find(r => r.action_id === tc.id);
                messages.push({
                    role: 'tool' as const,
                    toolCallId: tc.id,
                    content: result?.output || JSON.stringify({ approved: true, action_id: tc.id, executed: true }),
                } as UnifiedMessage);
            }
        } else {
            if (assistantText) {
                messages.push({ role: 'assistant', content: assistantText } as UnifiedMessage);
            }
            messages.push({ role: 'user', content: 'Continue.' } as UnifiedMessage);
        }

        // The continuation runs on the main turn engine with the paused turn's
        // own tools, so the model can call tools again and pause again (several
        // tool rounds per request), with the same output guard and billing.
        const storedTools = Array.isArray(sp.function_tools) ? (sp.function_tools as Tool[]) : [];
        const schemaToolName = typeof sp.schema_tool_name === 'string' ? sp.schema_tool_name : null;
        // A handoff brings its own tools; the paused turn's structured-output tool stays.
        const functionTools = override?.tools
            ? [...override.tools, ...storedTools.filter(t => schemaToolName && t.function.name === schemaToolName)]
            : storedTools;
        const needsApprovalToolNames = new Set(
            functionTools.filter(t => t.needsApproval).map(t => t.function.name),
        );

        const response = makeStream({
            supabase, gatewayCtx, sessionId,
            turnNumber: turnNumber + 1,
            resolved: resolved as never,
            messages,
            functionTools,
            forceSchemaResult: Boolean(schemaToolName),
            schemaToolName,
            tool_choice: sp.tool_choice as never,
            temperature: typeof sp.temperature === 'number' ? sp.temperature : undefined,
            max_output_tokens: typeof sp.max_output_tokens === 'number' ? sp.max_output_tokens : undefined,
            pauseOnToolCalls: sp.pause_on_tool_calls === true,
            needsApprovalToolNames,
            collectedBuiltinToolOutputs: [],
            reasoningEffort: storedEffort,
            pinnedConnectionId: storedPin,
            instructions,
            // The output guard sees the user's words and the tool results, as before.
            inputText: [inputText, resumedInputText].filter(Boolean).join('\n') || undefined,
            inputSecurity: resumedInputSecurity ?? storedInputSecurity,
            tokenMap: storedTokenMap.size > 0 ? storedTokenMap : undefined,
            endUserId: null,
            tier, logSuccess, incrementUsage, recordEndUserUsage,
            resumed: { fromTurn: turnNumber, toolResultIds: toolResults.map(r => r.action_id), originalInputText: inputText },
        });

        return { ok: true, response };
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Session engine error';
        return { ok: false, status: 500, body: { error: { message: msg, type: 'invalid_request_error', code: 'session_engine_error' }, status: 'failed' } };
    }
}

async function maybeCreateCheckpoint(
    supabase: SupabaseAdmin, sessionId: string, turnNumber: number,
    currentMessages: UnifiedMessage[], fullText: string,
): Promise<void> {
    if (turnNumber % 50 !== 0) return;
    try {
        const { data: prevCheckpoint } = await supabase
            .from('session_events')
            .select('payload')
            .eq('session_id', sessionId)
            .eq('event_type', 'turn.checkpoint')
            .lt('turn_number', turnNumber)
            .order('turn_number', { ascending: false })
            .limit(1)
            .single();

        const prevMessages: Array<{ role: string; content: string | null }> =
            prevCheckpoint
                ? (prevCheckpoint.payload as Record<string, unknown>).messages as Array<{ role: string; content: string | null }>
                : [];

        const messages = [
            ...prevMessages,
            ...currentMessages.map(m => ({ role: m.role, content: m.content ?? null })),
        ];
        if (fullText) {
            messages.push({ role: 'assistant', content: fullText });
        }

        const result = await supabase.from('session_events').insert({
            session_id: sessionId,
            turn_number: turnNumber,
            sequence: 0,
            event_type: 'turn.checkpoint',
            payload: { turn_number: turnNumber, messages },
        });
        if (result?.error) throw new Error(result.error.message);
    } catch (e) {
        console.error(`[SessionEngine] Failed to create checkpoint at turn ${turnNumber}:`, e);
    }
}

export { maybeCreateCheckpoint };

export function buildOutput(
    text: string,
    calls: Array<{ id: string; name: string; args: string }>,
    toolOutputs: ToolCallOutput[],
): Record<string, unknown> {
    const out: Record<string, unknown>[] = [];
    if (text) {
        out.push({ id: `msg_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`, type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text }] });
    }
    for (const c of calls) {
        out.push({ id: c.id, type: 'function_call', status: 'completed', call_id: c.id, name: c.name, arguments: c.args });
    }
    for (const to of toolOutputs) {
        out.push({ id: to.id, type: to.type, status: to.status, ...(to.output ? { output: to.output } : {}), ...(to.error ? { error: to.error } : {}) });
    }
    return { output: out };
}
