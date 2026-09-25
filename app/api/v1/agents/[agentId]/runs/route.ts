import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix, getIdempotencyKey } from '@/lib/embedded/http';
import { resolveAgentRuntimeConfig } from '@/lib/embedded/agents';
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

async function executeRun(runId: string): Promise<void> {
    const executorStartedAt = Date.now();
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

        // Resolve the configured agent (installation pin → stable → latest → legacy).
        const runtime = await resolveAgentRuntimeConfig(supabase as never, {
            agentId: run.agent_id,
            installationVersionId: ((ins as { agent_version_id?: string | null } | null)?.agent_version_id as string | null) ?? run.agent_version_id,
            updateChannel: ((ins as { update_channel?: string | null } | null)?.update_channel as string | null) ?? null,
        });
        const config = (runtime.config ?? {}) as { model?: string; instructions?: string; system_prompt?: string; temperature?: number; max_output_tokens?: number };
        const model = config.model?.trim();
        if (!model) {
            throw new Error('Agent has no model configured');
        }
        attemptedModel = model;
        const instructions = config.instructions ?? config.system_prompt ?? undefined;

        // Knowledge context: embed the input and retrieve per bound KB (fallback: first chunks).
        const citations: Array<{ chunk_id: string; source_id: string; score: number }> = [];
        const contextSnippets: string[] = [];
        const { input, responseFormat } = decodeRunRequest(run.input_ref);
        const inputText = JSON.stringify(input);
        // Installed skills are independent of KB retrieval; overlap their DB
        // lookups instead of serially extending pre-model latency.
        const skillsPromise = run.installation_id
            ? import('@/lib/embedded/turn-knowledge')
                .then(({ retrieveTurnSkills }) => retrieveTurnSkills(supabase as never, { installationId: run.installation_id, tenantId: run.tenant_id }))
                .catch(() => ({ block: null, skill_version_ids: [] as string[] }))
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

        const { executeGatewayChat } = await import('@/lib/gateway/chat-executor');
        const systemParts = [
            instructions ? `Instructions: ${instructions}` : null,
            contextSnippets.length > 0
                ? `Company knowledge (cite source IDs [src] in your answer):\n${contextSnippets.map((s, i) => `[${i + 1}] ${s}`).join('\n')}`
                : null,
            runSkillsBlock ? runSkillsBlock : null,
            wantsJson ? `Respond with JSON only, matching this schema: ${JSON.stringify(responseFormat?.json_schema?.schema ?? {})}` : null,
        ].filter(Boolean) as string[];

        const gatewayChatStartedAt = Date.now();
        const response = await executeGatewayChat({
            supabase: supabase as never,
            projectId: run.project_id,
            organizationId,
            tier,
            request: {
                messages: [
                    ...(systemParts.length > 0 ? [{ role: 'system' as const, content: systemParts.join('\n\n') }] : []),
                    { role: 'user' as const, content: inputText },
                ],
                model,
                temperature: config.temperature ?? undefined,
                maxTokens: config.max_output_tokens ?? undefined,
            },
            requestId: `run_${runId}`,
        });
        const gatewayChatMs = Date.now() - gatewayChatStartedAt;

        // A managed-key run must debit the wallet just like direct Gateway
        // inference. Charge immediately after provider success, even if later
        // JSON validation fails or cancellation discards the model output.
        const billingStartedAt = Date.now();
        let charged = false;
        try {
            charged = await chargeProjectUsageCredits(organizationId, tier, response.cost.cencoriChargeUsd, 'runs.execute');
        } catch {
            charged = false;
        }
        const billingMs = Date.now() - billingStartedAt;
        const preGatewayMs = gatewayChatStartedAt - executorStartedAt;

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
            prompt_tokens: response.usage.promptTokens,
            completion_tokens: response.usage.completionTokens,
            total_tokens: response.usage.totalTokens,
            latency_ms: gatewayChatMs,
            cost_usd: charged ? response.cost.cencoriChargeUsd : 0,
            provider_cost_usd: response.cost.providerCostUsd,
            cencori_charge_usd: charged ? response.cost.cencoriChargeUsd : 0,
            markup_percentage: response.cost.markupPercentage,
            tenant_id: run.tenant_id,
            agent_id: run.agent_id,
            installation_id: run.installation_id,
            run_id: runId,
            request_id: `run_${runId}`,
            request_payload: {},
            metadata: {
                run_timing_ms: { pre_gateway: preGatewayMs, gateway_chat: gatewayChatMs, billing: billingMs },
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
            knowledge_citations: citations,
            skills_used: runSkillIds,
            manifest_tools: ((runtime.config ?? {}) as { tools?: unknown }).tools ?? [],
            manifest_policy: ((runtime.config ?? {}) as { policy?: unknown }).policy ?? { browser: { enabled: false }, network: { mode: 'none', allowed_hosts: [] } },
            usage: response.usage,
            cost: response.cost,
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
                gatewayChatMs,
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

    const { data: agent } = await supabase.from('agents').select('id, project_id').eq('id', agentId).maybeSingle();
    if (!agent || (agent.project_id as string) !== validation.context.projectId) {
        return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Agent not found', { requestId }), { requestId });
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
