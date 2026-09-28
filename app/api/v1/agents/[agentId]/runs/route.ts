import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix, getIdempotencyKey } from '@/lib/embedded/http';
import { assertExecutionAdmissible, executionVersionInputs, resolveAgentRuntimeConfig } from '@/lib/embedded/agents';
import { registerRunController, unregisterRunController } from '@/lib/embedded/run-abort';
import { appendRunEvent, canTransition } from '@/lib/embedded/runs';
import { scheduleEmbeddedWebhook } from '@/lib/embedded/dispatch-webhook';
import { decodeRunRequest, encodeRunRequest, isRunResponseFormat, sameRunRequestBody } from '@/lib/embedded/run-request';
import { validateJsonSchema, validateRunSchemaDefinition } from '@/lib/embedded/json-schema';
import { chargeProjectUsageCredits } from '@/lib/project-credit-billing';
import { waitUntil } from '@vercel/functions';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// Opaque keyset cursor over (created_at, id). Raw-timestamp cursors are
// accepted for compatibility (no id tiebreaker there).
function encodeRunCursor(createdAt: string, id: string): string {
    return Buffer.from(JSON.stringify({ c: createdAt, i: id }), 'utf8').toString('base64url');
}

function parseRunCursor(raw: string | null): { cursor: { createdAt: string; id: string | null } } | { error: string } | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as { c?: unknown; i?: unknown };
        if (parsed && typeof parsed.c === 'string' && parsed.c) {
            return { cursor: { createdAt: parsed.c, id: typeof parsed.i === 'string' && parsed.i ? parsed.i : null } };
        }
    } catch {
        // Not an opaque cursor — fall through to legacy handling below.
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return { cursor: { createdAt: raw, id: null } };
    return { error: 'Invalid cursor' };
}

// GET /v1/agents/:agentId/runs — paginated run history for one agent.
// Covers queued, cancelled, and pre-inference failed runs that usage rows
// cannot supply.
export async function GET(req: NextRequest, ctx: { params: Promise<{ agentId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { agentId } = await ctx.params;
    const supabase = createAdminClient();
    const { data: agent } = await supabase.from('agents').select('id, project_id').eq('id', agentId).maybeSingle();
    if (!agent || (agent.project_id as string) !== validation.context.projectId) {
        return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Agent not found', { requestId }), { requestId });
    }
    const url = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '20', 10) || 20));
    const parsedCursor = parseRunCursor(url.searchParams.get('cursor'));
    if (parsedCursor && 'error' in parsedCursor) return addGatewayHeaders(embeddedError(400, 'invalid_request_error', parsedCursor.error, { requestId }), { requestId });
    let query = supabase
        .from('embedded_runs')
        .select('*')
        .eq('project_id', validation.context.projectId)
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1);
    if (parsedCursor && 'cursor' in parsedCursor && parsedCursor.cursor) {
        const { createdAt, id } = parsedCursor.cursor;
        query = id
            ? query.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`)
            : query.lt('created_at', createdAt);
    }
    const { data, error } = await query;
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    const rows = (data ?? []) as Record<string, unknown>[];
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    return addGatewayHeaders(
        NextResponse.json({
            data: page.map((r) => serializeRun(r)),
            next_cursor: hasMore && last ? encodeRunCursor(last.created_at as string, last.id as string) : null,
        }),
        { requestId },
    );
}

function serializeRun(row: Record<string, unknown>) {
    return {
        id: withPrefix('run', row.id as string),
        agent_id: row.agent_id,
        agent_version_id: row.agent_version_id ?? null,
        installation_id: row.installation_id ? withPrefix('ins', row.installation_id as string) : null,
        tenant_id: row.tenant_id ? withPrefix('ten', row.tenant_id as string) : null,
        external_user_id: row.external_user_id ?? null,
        session_id: row.session_id ?? null,
        status: row.status,
        input: decodeRunRequest(row.input_ref).input,
        output: row.output_ref ?? null,
        error: row.error ?? null,
        started_at: row.started_at ?? null,
        completed_at: row.completed_at ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

async function executeRun(runId: string): Promise<void> {    const executorStartedAt = Date.now();
    let attemptedModel: string | null = null;
    const supabase = createAdminClient();
    // Atomic claim: only one executor moves queued → running. A run that was
    // cancelled (or picked up twice) matches zero rows here and is left alone —
    // this closes the cancel-then-complete overwrite race.
    const { data: claimed } = await supabase
        .from('embedded_runs')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', runId)
        .eq('status', 'queued')
        .select('*')
        .maybeSingle();
    if (!claimed) return;
    const run = claimed as Record<string, unknown> & {
        project_id: string; tenant_id: string | null; agent_id: string;
        agent_version_id: string | null; installation_id: string | null;
        external_user_id: string | null; input_ref: Record<string, unknown>;
    };
    // Re-verify pause at execution start: admission may long predate it.
    // A paused agent or installation fails loudly instead of running stale.
    await assertExecutionAdmissible(supabase as never, {
        project_id: run.project_id,
        agent_id: run.agent_id,
        installation_id: run.installation_id,
    });
    // Cancellation signal: the cancel route aborts this controller so the
    // in-flight provider call stops and failover suppresses retries. The
    // conditional terminal writes below still let a concurrent cancel win.
    const abortController = new AbortController();
    registerRunController(runId, abortController);
    // Cross-instance backstop: the abort registry only signals this
    // process. Re-reading status at phase boundaries stops cancelled work
    // anywhere; the conditional terminal writes still decide the outcome.
    const throwIfCancelled = async () => {
        const { data } = await supabase.from('embedded_runs').select('status').eq('id', runId).maybeSingle();
        if ((data as { status?: string } | null)?.status !== 'running') throw new Error('Chat request aborted');
    };
    await appendRunEvent(supabase as never, runId, 'run.started', { run_id: runId });
    scheduleEmbeddedWebhook(run.project_id, 'run.started', { run_id: runId, agent_id: run.agent_id });

    // Conditional terminal write: verified so a concurrent cancel wins and the
    // model result is discarded instead of overwriting the cancelled state.
    const finish = async (patch: Record<string, unknown>, event: string, payload: Record<string, unknown>, webhook: string): Promise<boolean> => {
        const { data: done } = await supabase.from('embedded_runs').update(patch).eq('id', runId).eq('status', 'running').select('id').maybeSingle();
        if (!done) return false;
        await appendRunEvent(supabase as never, runId, event, payload);
        scheduleEmbeddedWebhook(run.project_id, webhook, { run_id: runId, agent_id: run.agent_id });
        return true;
    };

    try {
        const [{ data: project }, { data: ins }] = await Promise.all([
            supabase.from('projects').select('id, organization_id, organizations!inner(subscription_tier)').eq('id', run.project_id).maybeSingle(),
            run.installation_id
                ? supabase.from('agent_installations').select('agent_version_id, update_channel').eq('id', run.installation_id).maybeSingle()
                : Promise.resolve({ data: null }),
        ]);
        const organizationId = ((project as { organization_id?: string } | null)?.organization_id as string) ?? '';
        if (!organizationId) throw new Error('Run project has no organization');
        const tier = (((project as { organizations?: { subscription_tier?: string } } | null)?.organizations?.subscription_tier as string) ?? 'free') as import('@/lib/entitlements').SubscriptionTier;

        // Resolve the configured agent. The submission-pinned version wins:
        // upgrades between submit and start apply to newly created runs only.
        // Rows without a pin (legacy) fall back to live installation/channel
        // resolution exactly as before.
        const versionInputs = executionVersionInputs(
            { agent_version_id: run.agent_version_id },
            ins as { agent_version_id?: string | null; update_channel?: string | null } | null,
        );
        const runtime = await resolveAgentRuntimeConfig(supabase as never, {
            agentId: run.agent_id,
            installationVersionId: versionInputs.installationVersionId,
            updateChannel: versionInputs.updateChannel,
        });
        const config = (runtime.config ?? {}) as { model?: string; instructions?: string; system_prompt?: string; temperature?: number; max_output_tokens?: number; reasoning_effort?: string; provider_connection_id?: string };
        const model = config.model?.trim();
        if (!model) {
            throw new Error('Agent has no model configured');
        }
        attemptedModel = model;
        // Manifest controls, validated at publish; re-checked defensively
        // here so a hand-edited config can never inject an invalid value.
        const { REASONING_EFFORTS } = await import('@/lib/embedded/manifest');
        const reasoningEffort = (REASONING_EFFORTS as readonly string[]).includes(config.reasoning_effort as string)
            ? (config.reasoning_effort as 'low' | 'medium' | 'high')
            : undefined;
        const pinnedConnectionId = typeof config.provider_connection_id === 'string' && config.provider_connection_id.trim()
            ? config.provider_connection_id.trim()
            : null;
        const instructions = config.instructions ?? config.system_prompt ?? undefined;

        // Knowledge context: embed the input and retrieve per bound KB (fallback: first chunks).
        const citations: Array<{ chunk_id: string; source_id: string; score: number }> = [];
        const contextSnippets: string[] = [];
        const { input, responseFormat } = decodeRunRequest(run.input_ref);
        const inputText = JSON.stringify(input);
        // Installed skills are independent of KB retrieval; overlap their DB
        // lookups instead of serially extending pre-model latency. Skills
        // follow the submission-pinned version, not the live installation.
        const skillsPromise = run.installation_id
            ? import('@/lib/embedded/turn-knowledge')
                .then(({ retrieveTurnSkills }) => retrieveTurnSkills(supabase as never, { installationId: run.installation_id, tenantId: run.tenant_id, versionId: run.agent_version_id }))
                .catch(() => ({ block: null, skill_version_ids: [] as string[], failed: true }))
            : Promise.resolve({ block: null, skill_version_ids: [] as string[] });
        if (run.installation_id) {
            const { data: bindings } = await supabase.from('installation_knowledge_bases').select('knowledge_base_id').eq('installation_id', run.installation_id);
            // Skip the embedding call entirely when nothing is bound — it is
            // billed work with no retrieval to serve.
            if (!bindings || (bindings as Array<{ knowledge_base_id: string }>).length === 0) {
                // No knowledge bound; citations stay empty.
            } else try {
                const { embedForMemory } = await import('@/lib/memory/embeddings');
                const embedded = await embedForMemory(supabase as never, run.project_id, organizationId, inputText.slice(-2000));
                const vector = `[${embedded.embeddings[0].join(',')}]`;
                for (const b of (bindings ?? []) as Array<{ knowledge_base_id: string }>) {
                    const { data: hits } = await supabase.rpc('match_knowledge_chunks', {
                        p_knowledge_base_id: b.knowledge_base_id,
                        p_query_embedding: vector,
                        p_match_count: 3,
                    });
                    for (const h of (hits ?? []) as Array<{ id: string; source_id: string; content: string; similarity: number }>) {
                        citations.push({ chunk_id: h.id, source_id: h.source_id, score: h.similarity });
                        contextSnippets.push(h.content.slice(0, 500));
                        if (citations.length >= 5) break;
                    }
                    if (citations.length >= 5) break;
                }
            } catch {
                // Embedding/RPC unavailable — fall back to recent chunks so the run still carries citations.
                for (const b of (bindings ?? []) as Array<{ knowledge_base_id: string }>) {
                    const { data: chunks } = await supabase.from('knowledge_chunks').select('id, source_id, content').eq('knowledge_base_id', b.knowledge_base_id).limit(3);
                    for (const c of (chunks ?? []) as Array<{ id: string; source_id: string; content: string }>) {
                        citations.push({ chunk_id: c.id, source_id: c.source_id, score: 1 });
                        contextSnippets.push(c.content.slice(0, 500));
                        if (citations.length >= 5) break;
                    }
                    if (citations.length >= 5) break;
                }
            }
        }

        const wantsJson = Boolean(responseFormat);

        // Pinned skill procedures for the installed version (tenant-filtered).
        const skills = await skillsPromise;
        const runSkillsBlock = skills.block;
        const runSkillIds = skills.skill_version_ids;
        if ((skills as { failed?: boolean }).failed === true) {
            await appendRunEvent(supabase as never, runId, 'skills.unavailable', { run_id: runId, reason: 'skill read failed; turn runs without skill procedures' });
        }

        const { executeGatewayChat } = await import('@/lib/gateway/chat-executor');
        const systemParts = [
            instructions ? `Instructions: ${instructions}` : null,
            contextSnippets.length > 0
                ? `Company knowledge (cite source IDs [src] in your answer):\n${contextSnippets.map((s, i) => `[${i + 1}] ${s}`).join('\n')}`
                : null,
            runSkillsBlock ? runSkillsBlock : null,
            wantsJson ? `Respond with JSON only, matching this schema: ${JSON.stringify(responseFormat?.json_schema?.schema ?? {})}` : null,
        ].filter(Boolean) as string[];

        // Hosted MCP tool loop: manifest grants are offered to the model;
        // read-classified calls execute now against their granting server,
        // approval-gated calls become pending actions and fail the run
        // loudly (a human completes them via the actions API). Bounded at
        // 5 model turns; spend re-checked every iteration.
        const { normalizeManifest } = await import('@/lib/embedded/manifest');
        const runManifest = normalizeManifest((runtime.config ?? {}) as Record<string, unknown>);
        const { loadMcpSnapshots, callMcpTool, mcpAuthHeaders } = await import('@/lib/embedded/mcp');
        const { mcpManifestTools, parseMcpHostedToolName } = await import('@/lib/embedded/turn-tools');
        const { classifyTool } = await import('@/lib/embedded/tool-risk');
        const runSnapshots: Map<string, import('@/lib/embedded/mcp').McpServerSnapshot> = runManifest.mcp_tools.length > 0
            ? await loadMcpSnapshots(supabase as never, run.project_id, runManifest.mcp_tools.map((m) => m.server_id))
            : new Map();
        const runMcpTools = mcpManifestTools(
            runManifest.mcp_tools,
            new Map([...runSnapshots].map(([id, snap]) => [id, snap.tools])),
        );
        const { resolveActionNetworkPolicy, checkEgress } = await import('@/lib/embedded/net-policy');
        const runNetPolicy = await resolveActionNetworkPolicy(supabase as never, { project_id: run.project_id, run_id: runId, approval_policy: {} });
        const { checkSpendBudgets } = await import('@/lib/embedded/budgets');

        const baseMessages: import('@/lib/providers/base').UnifiedMessage[] = [
            ...(systemParts.length > 0 ? [{ role: 'system' as const, content: systemParts.join('\n\n') }] : []),
            { role: 'user' as const, content: inputText },
        ];
        let loopMessages = [...baseMessages];
        let response: Awaited<ReturnType<typeof executeGatewayChat>> | null = null;
        let totalPrompt = 0;
        let totalCompletion = 0;
        let totalProviderCost = 0;
        let totalCharge = 0;
        let totalGatewayMs = 0;
        let markupPercentage = 0;
        const executedToolCalls: Array<{ tool: string; status: 'executed' | 'failed'; action_id: string }> = [];
        const pendingApprovals: Array<{ action_id: string; tool: string }> = [];
        const MAX_TOOL_ITERATIONS = 5;
        const preGatewayMs = Date.now() - executorStartedAt;

        for (let iteration = 0; ; iteration++) {
            if (abortController.signal.aborted) throw new Error('Chat request aborted');
            await throwIfCancelled();
            const gatewayChatStartedAt = Date.now();
            response = await executeGatewayChat({
                supabase: supabase as never,
                projectId: run.project_id,
                organizationId,
                tier,
                request: {
                    messages: loopMessages,
                    model,
                    temperature: config.temperature ?? undefined,
                    maxTokens: config.max_output_tokens ?? undefined,
                    signal: abortController.signal,
                    ...(reasoningEffort ? { reasoningEffort } : {}),
                    ...(runMcpTools.length > 0 ? { tools: runMcpTools as never } : {}),
                },
                requestId: `run_${runId}`,
                ...(pinnedConnectionId ? { pinnedConnectionId } : {}),
            });
            const gatewayChatMs = Date.now() - gatewayChatStartedAt;
            totalGatewayMs += gatewayChatMs;
            totalPrompt += response.usage.promptTokens;
            totalCompletion += response.usage.completionTokens;
            totalProviderCost += response.cost.providerCostUsd;
            totalCharge += response.cost.cencoriChargeUsd;
            markupPercentage = response.cost.markupPercentage;

            const calls = (response.toolCalls ?? []).filter((tc) => tc.function?.name);
            if (calls.length === 0 || iteration >= MAX_TOOL_ITERATIONS) break;

            const spend = await checkSpendBudgets(supabase as never, { projectId: run.project_id, tenantId: run.tenant_id, installationId: run.installation_id, agentId: run.agent_id });
            if (!spend.ok) {
                throw Object.assign(new Error(`${spend.scope} spend budget exceeded`), { status: 402, code: 'budget_exceeded' });
            }

            const assistantCalls = calls.map((tc) => ({ id: tc.id, type: 'function' as const, function: { name: tc.function.name, arguments: tc.function.arguments } }));
            loopMessages = [...loopMessages, { role: 'assistant' as const, content: response.content || '', tool_calls: assistantCalls }];

            let progressed = false;
            for (const tc of calls) {
                const parsed = parseMcpHostedToolName(tc.function.name);
                const server = parsed
                    ? [...runSnapshots.values()].find((s) => s.id.replace(/-/g, '').toLowerCase().startsWith(parsed.serverShort.toLowerCase()) && s.tools.some((t) => t.name === parsed.tool))
                    : undefined;
                if (!parsed || !server) {
                    loopMessages = [...loopMessages, { role: 'tool' as const, content: `Unknown tool '${tc.function.name}': not granted by this agent version`, toolCallId: tc.id }];
                    continue;
                }
                const needsApproval = (runMcpTools.find((t) => (t as { function: { name: string } }).function.name === tc.function.name) as { needsApproval?: boolean } | undefined)?.needsApproval === true
                    || classifyTool(parsed.tool).approval !== 'auto';
                let args: Record<string, unknown> = {};
                try {
                    args = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>;
                } catch {
                    loopMessages = [...loopMessages, { role: 'tool' as const, content: `Invalid arguments JSON for '${tc.function.name}'`, toolCallId: tc.id }];
                    continue;
                }
                if (needsApproval) {
                    const executionKey = `run_${runId}_i${iteration}_${tc.id}`.slice(0, 64);
                    const { data: action } = await supabase.from('actions').insert({
                        project_id: run.project_id,
                        tenant_id: run.tenant_id,
                        run_id: runId,
                        session_id: null,
                        turn_number: null,
                        tool_name: tc.function.name,
                        risk_level: classifyTool(parsed.tool).risk,
                        status: 'pending',
                        sanitized_arguments: args,
                        approval_policy: { mcp_server_id: server.id, mcp_tool: parsed.tool },
                        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
                        execution_key: executionKey,
                    }).select('id').single();
                    pendingApprovals.push({ action_id: (action as { id: string } | null)?.id ?? tc.id, tool: tc.function.name });
                    continue;
                }
                const egress = await checkEgress(server.url, runNetPolicy);
                if (!egress.allowed) {
                    loopMessages = [...loopMessages, { role: 'tool' as const, content: `Network policy denied MCP egress to ${egress.host ?? 'unknown host'}: ${egress.reason}`, toolCallId: tc.id }];
                    executedToolCalls.push({ tool: tc.function.name, status: 'failed', action_id: tc.id });
                    continue;
                }
                try {
                    const headers = await mcpAuthHeaders(supabase as never, run.project_id, organizationId, server.authConnectionId);
                    const output = await callMcpTool({ url: server.url, headers, transport: server.transport === 'sse' ? 'sse' : 'streamable-http', tool: parsed.tool, args });
                    loopMessages = [...loopMessages, { role: 'tool' as const, content: typeof output === 'string' ? output : JSON.stringify(output ?? null).slice(0, 8000), toolCallId: tc.id }];
                    executedToolCalls.push({ tool: tc.function.name, status: 'executed', action_id: tc.id });
                    await appendRunEvent(supabase as never, runId, 'tool_call.completed', { run_id: runId, tool: tc.function.name, action_id: tc.id, executed_by: 'host' });
                    progressed = true;
                } catch (e) {
                    loopMessages = [...loopMessages, { role: 'tool' as const, content: `Tool '${tc.function.name}' failed: ${(e instanceof Error ? e.message : 'unknown').slice(0, 500)}`, toolCallId: tc.id }];
                    executedToolCalls.push({ tool: tc.function.name, status: 'failed', action_id: tc.id });
                    progressed = true;
                }
            }

            if (pendingApprovals.length > 0) {
                throw Object.assign(
                    new Error(`Approval required for ${pendingApprovals.length} tool call(s): ${pendingApprovals.map((p) => `${p.tool} (action ${p.action_id})`).join(', ')}. Approve via POST /v1/actions/:id/approve.`),
                    { status: 409, code: 'approval_required', pendingApprovals },
                );
            }
            if (!progressed) break;
        }
        if (!response) throw new Error('Provider produced no response');

        // A cancel that landed after provider success must not be billed:
        // the terminal write below would lose to it anyway.
        if (abortController.signal.aborted) throw new Error('Chat request aborted');
        await throwIfCancelled();

        // A managed-key run must debit the wallet just like direct Gateway
        // inference. Charge immediately after provider success, even if later
        // JSON validation fails or cancellation discards the model output.
        // Totals accumulate across tool-loop iterations.
        const billingStartedAt = Date.now();
        let charged = false;
        try {
            charged = await chargeProjectUsageCredits(organizationId, tier, totalCharge, 'runs.execute');
        } catch {
            charged = false;
        }
        const billingMs = Date.now() - billingStartedAt;

        // Spend budgets read this row, so it must be committed before the run
        // becomes complete. This contains no prompts or KB snippets.
        const meteringStartedAt = Date.now();
        const { error: usageError } = await supabase.from('ai_requests').insert({
            project_id: run.project_id,
            api_key_id: null,
            environment: 'production',
            endpoint: 'runs.execute',
            model: response.model,
            provider: response.provider,
            status: charged ? 'success' : 'error',
            prompt_tokens: totalPrompt,
            completion_tokens: totalCompletion,
            total_tokens: totalPrompt + totalCompletion,
            latency_ms: totalGatewayMs,
            cost_usd: charged ? totalCharge : 0,
            provider_cost_usd: totalProviderCost,
            cencori_charge_usd: charged ? totalCharge : 0,
            markup_percentage: markupPercentage,
            tenant_id: run.tenant_id,
            agent_id: run.agent_id,
            installation_id: run.installation_id,
            run_id: runId,
            request_id: `run_${runId}`,
            request_payload: {},
            metadata: {
                run_timing_ms: { pre_gateway: preGatewayMs, gateway_chat: totalGatewayMs, billing: billingMs },
                ...(charged ? {} : { billing_reconciliation_required: true, reason: 'credit_deduction_failed' }),
            },
        });
        const meteringMs = Date.now() - meteringStartedAt;
        if (usageError) {
            console.warn('[EmbeddedRun] Inference log insert failed', { runId, code: usageError.code });
            throw new Error('billing_reconciliation_required:metering_failure');
        }

        if (!charged) throw new Error('billing_reconciliation_required:credit_deduction_failed');

        let output: unknown = response.content;
        if (wantsJson) {
            // Strict contract: a requested json_schema must be satisfied or the
            // run fails loudly. Silent parse_error completions hid model
            // non-compliance from customers.
            const schema = responseFormat?.json_schema?.schema ?? {};
            let parsed: unknown;
            try {
                parsed = JSON.parse(response.content);
            } catch {
                throw new Error('Model output was not valid JSON for the requested json_schema');
            }
            const violations = validateJsonSchema(schema, parsed);
            if (violations.length > 0) {
                throw new Error(`Model output failed response schema: ${violations.slice(0, 3).join('; ')}`);
            }
            output = parsed;
        }
        const outputRef = {
            type: (input && typeof input === 'object' && !Array.isArray(input) ? (input as { type?: string }).type : undefined) ?? 'result',
            output,
            model: response.model,
            provider: response.provider,
            agent_version_id: runtime.versionId,
            agent_version: runtime.version,
            reasoning_effort_applied: reasoningEffort ?? null,
            knowledge_citations: citations,
            skills_used: runSkillIds,
            skills_failed: (skills as { failed?: boolean }).failed === true,
            manifest_tools: ((runtime.config ?? {}) as { tools?: unknown }).tools ?? [],
            manifest_policy: ((runtime.config ?? {}) as { policy?: unknown }).policy ?? { browser: { enabled: false }, network: { mode: 'none', allowed_hosts: [] } },
            usage: {
                promptTokens: totalPrompt,
                completionTokens: totalCompletion,
                totalTokens: totalPrompt + totalCompletion,
            },
            cost: {
                providerCostUsd: totalProviderCost,
                cencoriChargeUsd: totalCharge,
                markupPercentage,
            },
            tool_calls: executedToolCalls,
        };

        const finalizationStartedAt = Date.now();
        const completed = await finish(
            { status: 'completed', output_ref: outputRef, completed_at: new Date().toISOString() },
            'run.completed',
            { run_id: runId, model: response.model, citations: citations.length },
            'run.completed',
        );
        if (completed) {
            const createdAt = Date.parse(String(run.created_at ?? ''));
            console.info('[EmbeddedRun] timing', {
                runId,
                queueMs: Number.isFinite(createdAt) ? executorStartedAt - createdAt : null,
                preGatewayMs,
                gatewayChatMs: totalGatewayMs,
                billingMs,
                meteringMs,
                finalizationMs: Date.now() - finalizationStartedAt,
                totalExecutorMs: Date.now() - executorStartedAt,
            });
        }
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Run failed';
        const providerTimeout = attemptedModel !== null && /timed out after \d+ms/.test(message);
        const errorText = providerTimeout ? `billing_reconciliation_required:provider_timeout; ${message}` : message;
        if (providerTimeout) {
            try {
                const { error: reconciliationError } = await supabase.from('ai_requests').insert({
                    project_id: run.project_id,
                    api_key_id: null,
                    environment: 'production',
                    endpoint: 'runs.execute',
                    model: attemptedModel,
                    provider: 'unknown',
                    status: 'error',
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0,
                    latency_ms: Date.now() - executorStartedAt,
                    cost_usd: 0,
                    provider_cost_usd: 0,
                    cencori_charge_usd: 0,
                    tenant_id: run.tenant_id,
                    agent_id: run.agent_id,
                    installation_id: run.installation_id,
                    run_id: runId,
                    request_id: `run_${runId}`,
                    request_payload: {},
                    metadata: { billing_reconciliation_required: true, reason: 'provider_timeout' },
                });
                if (reconciliationError) console.warn('[EmbeddedRun] Reconciliation log insert failed', { runId, code: reconciliationError.code });
            } catch {
                console.warn('[EmbeddedRun] Reconciliation log unavailable', { runId });
            }
        }
        const applied = await (async () => {
            const { data: done } = await supabase.from('embedded_runs').update({ status: 'failed', error: errorText.slice(0, 1000), completed_at: new Date().toISOString() }).eq('id', runId).eq('status', 'running').select('id').maybeSingle();
            return Boolean(done);
        })();
        if (applied) {
            await appendRunEvent(supabase as never, runId, 'run.failed', { run_id: runId, error: errorText.slice(0, 500) });
            scheduleEmbeddedWebhook(run.project_id, 'run.failed', { run_id: runId, error: errorText.slice(0, 300) });
        }
    } finally {
        unregisterRunController(runId);
    }
}

// POST /v1/agents/:agentId/runs — idempotent background run creation.
export async function POST(req: NextRequest, ctx: { params: Promise<{ agentId: string }> }) {
    const requestStartedAt = Date.now();
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { agentId } = await ctx.params;
    const supabase = createAdminClient();

    const { data: agent } = await supabase.from('agents').select('id, project_id, is_active').eq('id', agentId).maybeSingle();
    if (!agent || (agent.project_id as string) !== validation.context.projectId) {
        return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Agent not found', { requestId }), { requestId });
    }
    // Paused agents admit no new work. Installation/tenant gates below cover
    // bound runs; this covers direct (unbound) runs.
    if ((agent.is_active as boolean | null) === false) {
        return addGatewayHeaders(embeddedError(403, 'agent_disabled', 'Agent is disabled', { requestId }), { requestId });
    }

    let body: { installation_id?: string; tenant_id?: string; external_user_id?: string; mode?: string; input?: unknown; response_format?: unknown; session_id?: string };
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Run request must be a JSON object', { requestId }), { requestId });
    }

    if (body.response_format !== undefined && !isRunResponseFormat(body.response_format)) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'response_format must contain a json_schema object', { requestId, param: 'response_format' }), { requestId });
    }
    if (isRunResponseFormat(body.response_format)) {
        const schemaErrors = validateRunSchemaDefinition(body.response_format.json_schema.schema);
        if (schemaErrors.length > 0) {
            return addGatewayHeaders(embeddedError(400, 'invalid_request_error', schemaErrors[0], { requestId, param: 'response_format.json_schema.schema' }), { requestId });
        }
    }
    const input = body.input ?? {};
    if (Buffer.byteLength(JSON.stringify(input), 'utf8') > 65_536) {
        return addGatewayHeaders(embeddedError(413, 'input_too_large', 'Run input exceeds the 64 KiB limit', { requestId, param: 'input' }), { requestId });
    }
    const persistedRequest = encodeRunRequest(input, body.response_format as ReturnType<typeof decodeRunRequest>['responseFormat'], body.mode ?? 'background');

    const idempotencyKey = getIdempotencyKey(req.headers);
    if (idempotencyKey) {
        const { data: existing } = await supabase.from('embedded_runs').select('*').eq('project_id', validation.context.projectId).eq('idempotency_key', idempotencyKey).maybeSingle();
        if (existing) {
            const stored = (existing as { input_ref: unknown }).input_ref;
            // Stable comparison: jsonb round-trips do not preserve key order,
            // so plain JSON.stringify can falsely report identical bodies as
            // different (see SDK 1.7.2 retest finding 1).
            if (!sameRunRequestBody(stored, persistedRequest)) {
                return addGatewayHeaders(embeddedError(409, 'idempotency_conflict', 'Idempotency key already used with a different body', { requestId }), { requestId });
            }
            return addGatewayHeaders(NextResponse.json(serializeRun(existing as Record<string, unknown>)), { requestId });
        }
    }

    // Resolve tenant + installation scope.
    let tenantId: string | null = null;
    let installationId: string | null = null;
    let installationVersionId: string | null = null;
    let installationUpdateChannel: string | null = null;
    if (body.installation_id) {
        const { data: ins } = await supabase.from('agent_installations').select('id, tenant_id, agent_id, agent_version_id, update_channel, status').eq('project_id', validation.context.projectId).eq('id', dePrefixId(body.installation_id)).maybeSingle();
        if (!ins || (ins.agent_id as string) !== agentId) {
            return addGatewayHeaders(embeddedError(404, 'installation_not_found', 'Installation not found for agent', { requestId }), { requestId });
        }
        if ((ins.status as string) !== 'active') {
            return addGatewayHeaders(embeddedError(409, 'invalid_request_error', 'Installation is not active', { requestId }), { requestId });
        }
        installationId = (ins.id as string);
        tenantId = (ins.tenant_id as string);
        installationVersionId = (ins.agent_version_id as string | null) ?? null;
        installationUpdateChannel = (ins.update_channel as string | null) ?? null;
    } else if (body.tenant_id) {
        const raw = dePrefixId(body.tenant_id);
        const { data: tenant } = await supabase.from('platform_tenants').select('id, status').eq('project_id', validation.context.projectId).eq('id', raw).maybeSingle();
        const t = tenant ?? (await supabase.from('platform_tenants').select('id, status').eq('project_id', validation.context.projectId).eq('external_id', body.tenant_id).maybeSingle()).data;
        if (!t) return addGatewayHeaders(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }), { requestId });
        tenantId = (t.id as string);
    }

    // Suspended tenants accept no new work (deletion/suspension propagation).
    if (tenantId) {
        const { data: tenantRow } = await supabase.from('platform_tenants').select('status').eq('id', tenantId).maybeSingle();
        if (!tenantRow || (tenantRow.status as string) !== 'active') {
            return addGatewayHeaders(embeddedError(403, 'tenant_suspended', 'Tenant is not active', { requestId }), { requestId });
        }
    }
    const runtime = await resolveAgentRuntimeConfig(supabase as never, {
        agentId,
        installationVersionId,
        updateChannel: installationUpdateChannel,
    });

    const mode = body.mode ?? 'background';
    if (!['sync', 'background', 'streaming'].includes(mode)) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid mode', { requestId }), { requestId });
    }

    // M4: fair scheduling — per-scope rate + concurrency caps before enqueue.
    {
        const tier = (validation.context.tier as import('@/lib/entitlements').SubscriptionTier) ?? 'free';
        const { checkRunRate, checkRunConcurrency } = await import('@/lib/embedded/limits');
        const scopeKey = installationId ?? tenantId ?? validation.context.projectId;
        const rate = await checkRunRate(scopeKey, tier);
        if (!rate.ok) {
            const res = embeddedError(429, rate.code, rate.message, { requestId });
            if (rate.retryAfterSeconds) res.headers.set('Retry-After', String(rate.retryAfterSeconds));
            return addGatewayHeaders(res, { requestId });
        }
        const { checkSpendBudgets } = await import('@/lib/embedded/budgets');
        const [concurrency, budget] = await Promise.all([
            checkRunConcurrency(supabase as never, installationId, tenantId, tier),
            checkSpendBudgets(supabase as never, { projectId: validation.context.projectId, tenantId, installationId, agentId }),
        ]);
        if (!concurrency.ok) {
            const res = embeddedError(429, concurrency.code, concurrency.message, { requestId });
            res.headers.set('Retry-After', '1');
            return addGatewayHeaders(res, { requestId });
        }
        if (!budget.ok) {
            return addGatewayHeaders(embeddedError(402, 'budget_exceeded', `${budget.scope} spend budget exceeded (spent $${(budget.spent ?? 0).toFixed(2)} of $${(budget.budget ?? 0).toFixed(2)})`, { requestId }), { requestId });
        }
    }

    const { data: run, error } = await supabase
        .from('embedded_runs')
        .insert({
            project_id: validation.context.projectId,
            tenant_id: tenantId,
            external_user_id: body.external_user_id ?? null,
            agent_id: agentId,
            agent_version_id: runtime.versionId,
            installation_id: installationId,
            session_id: body.session_id ?? null,
            status: 'queued',
            input_ref: persistedRequest,
            idempotency_key: idempotencyKey,
        })
        .select('*')
        .single();
    if (error || !run) {
        if (error?.code === '23505' && idempotencyKey) {
            const { data: existing } = await supabase.from('embedded_runs').select('*').eq('project_id', validation.context.projectId).eq('idempotency_key', idempotencyKey).maybeSingle();
            if (existing) {
                const stored = (existing as { input_ref: unknown }).input_ref;
                if (!sameRunRequestBody(stored, persistedRequest)) {
                    return addGatewayHeaders(embeddedError(409, 'idempotency_conflict', 'Idempotency key already used with a different body', { requestId }), { requestId });
                }
                return addGatewayHeaders(NextResponse.json(serializeRun(existing as Record<string, unknown>)), { requestId });
            }
        }
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Failed to create run', { requestId }), { requestId });
    }
    const runRow = run as Record<string, unknown>;
    await appendRunEvent(supabase as never, runRow.id as string, 'run.queued', { run_id: runRow.id, mode });
    scheduleEmbeddedWebhook(validation.context.projectId, 'run.queued', { run_id: runRow.id, agent_id: agentId, mode });
    console.info('[EmbeddedRun] submission timing', {
        runId: runRow.id,
        mode,
        admissionMs: Date.now() - requestStartedAt,
    });

    if (mode === 'sync') {
        await executeRun(runRow.id as string);
        const { data: done } = await supabase.from('embedded_runs').select('*').eq('id', runRow.id as string).single();
        return addGatewayHeaders(NextResponse.json(serializeRun((done ?? run) as Record<string, unknown>), { status: 201 }), { requestId });
    }
    void canTransition;
    waitUntil(executeRun(runRow.id as string));
    return addGatewayHeaders(NextResponse.json(serializeRun(runRow), { status: 202 }), { requestId });
}
