import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix, getIdempotencyKey } from '@/lib/embedded/http';
import { resolveAgentRuntimeConfig } from '@/lib/embedded/agents';
import { appendRunEvent, canTransition, emitEmbeddedEvent } from '@/lib/embedded/runs';
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
        input: row.input_ref ?? {},
        output: row.output_ref ?? null,
        error: row.error ?? null,
        started_at: row.started_at ?? null,
        completed_at: row.completed_at ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

async function executeRun(runId: string): Promise<void> {
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
    await emitEmbeddedEvent(run.project_id as string, 'run.started', { run_id: runId, agent_id: run.agent_id });

    // Conditional terminal write: verified so a concurrent cancel wins and the
    // model result is discarded instead of overwriting the cancelled state.
    const finish = async (patch: Record<string, unknown>, event: string, payload: Record<string, unknown>, webhook: string): Promise<boolean> => {
        const { data: done } = await supabase.from('embedded_runs').update(patch).eq('id', runId).eq('status', 'running').select('id').maybeSingle();
        if (!done) return false;
        await appendRunEvent(supabase as never, runId, event, payload);
        await emitEmbeddedEvent(run.project_id as string, webhook, { run_id: runId, agent_id: run.agent_id });
        return true;
    };

    try {
        const { data: project } = await supabase.from('projects').select('id, organization_id, organizations!inner(subscription_tier)').eq('id', run.project_id).maybeSingle();
        const organizationId = ((project as { organization_id?: string } | null)?.organization_id as string) ?? '';
        const tier = (((project as { organizations?: { subscription_tier?: string } } | null)?.organizations?.subscription_tier as string) ?? 'free') as import('@/lib/entitlements').SubscriptionTier;

        // Resolve the configured agent (installation pin → stable → latest → legacy).
        const { data: ins } = run.installation_id
            ? await supabase.from('agent_installations').select('agent_version_id, update_channel').eq('id', run.installation_id).maybeSingle()
            : { data: null };
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
        const instructions = config.instructions ?? config.system_prompt ?? undefined;

        // Knowledge context: embed the input and retrieve per bound KB (fallback: first chunks).
        const citations: Array<{ chunk_id: string; source_id: string; score: number }> = [];
        const contextSnippets: string[] = [];
        const inputText = JSON.stringify(run.input_ref ?? {}).slice(0, 2000);
        if (run.installation_id) {
            const { data: bindings } = await supabase.from('installation_knowledge_bases').select('knowledge_base_id').eq('installation_id', run.installation_id);
            try {
                const { embedForMemory } = await import('@/lib/memory/embeddings');
                const embedded = await embedForMemory(supabase as never, run.project_id, organizationId, inputText);
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

        const responseFormat = (run.input_ref as { response_format?: { type?: string; json_schema?: { name?: string; schema?: Record<string, unknown> } } }).response_format;
        const wantsJson = responseFormat?.type === 'json_schema';

        // Pinned skill procedures for the installed version (tenant-filtered).
        let runSkillsBlock: string | null = null;
        let runSkillIds: string[] = [];
        if (run.installation_id) {
            try {
                const { retrieveTurnSkills } = await import('@/lib/embedded/turn-knowledge');
                const skills = await retrieveTurnSkills(supabase as never, { installationId: run.installation_id, tenantId: run.tenant_id });
                runSkillsBlock = skills.block;
                runSkillIds = skills.skill_version_ids;
            } catch {
                runSkillsBlock = null;
            }
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
            const { validateJsonSchema } = await import('@/lib/embedded/json-schema');
            const violations = validateJsonSchema(schema, parsed);
            if (violations.length > 0) {
                throw new Error(`Model output failed response schema: ${violations.slice(0, 3).join('; ')}`);
            }
            output = parsed;
        }
        const outputRef = {
            type: (run.input_ref as { type?: string })?.type ?? 'result',
            output,
            model: response.model,
            provider: response.provider,
            agent_version_id: runtime.versionId,
            agent_version: runtime.version,
            knowledge_citations: citations,
            skills_used: runSkillIds,
            manifest_tools: ((runtime.config ?? {}) as { tools?: unknown }).tools ?? [],
            usage: response.usage,
        };

        // Attribute the model call (best-effort; never fails the run).
        try {
            await supabase.from('ai_requests').insert({
                project_id: run.project_id,
                api_key_id: null,
                environment: 'production',
                endpoint: 'runs.execute',
                model: response.model,
                provider: response.provider,
                status: 'success',
                prompt_tokens: response.usage.promptTokens,
                completion_tokens: response.usage.completionTokens,
                total_tokens: response.usage.totalTokens,
                cost_usd: response.cost.cencoriChargeUsd,
                provider_cost_usd: response.cost.providerCostUsd,
                cencori_charge_usd: response.cost.cencoriChargeUsd,
                markup_percentage: response.cost.markupPercentage,
                tenant_id: run.tenant_id,
                agent_id: run.agent_id,
                installation_id: run.installation_id,
                run_id: runId,
                request_id: `run_${runId}`,
                request_payload: {},
            });
        } catch {
            // logging must never fail the run
        }

        await finish(
            { status: 'completed', output_ref: outputRef, completed_at: new Date().toISOString() },
            'run.completed',
            { run_id: runId, model: response.model, citations: citations.length },
            'run.completed',
        );
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Run failed';
        const applied = await (async () => {
            const { data: done } = await supabase.from('embedded_runs').update({ status: 'failed', error: message.slice(0, 1000), completed_at: new Date().toISOString() }).eq('id', runId).eq('status', 'running').select('id').maybeSingle();
            return Boolean(done);
        })();
        if (applied) {
            await appendRunEvent(supabase as never, runId, 'run.failed', { run_id: runId, error: message.slice(0, 500) });
            await emitEmbeddedEvent(run.project_id as string, 'run.failed', { run_id: runId, error: message.slice(0, 300) });
        }
    }
}

// POST /v1/agents/:agentId/runs — idempotent background run creation.
export async function POST(req: NextRequest, ctx: { params: Promise<{ agentId: string }> }) {
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

    const idempotencyKey = getIdempotencyKey(req.headers);
    if (idempotencyKey) {
        const { data: existing } = await supabase.from('embedded_runs').select('*').eq('project_id', validation.context.projectId).eq('idempotency_key', idempotencyKey).maybeSingle();
        if (existing) {
            const sameBody = JSON.stringify((existing as { input_ref: unknown }).input_ref) === JSON.stringify(body.input ?? {});
            if (!sameBody) {
                return addGatewayHeaders(embeddedError(409, 'idempotency_conflict', 'Idempotency key already used with a different body', { requestId }), { requestId });
            }
            return addGatewayHeaders(NextResponse.json(serializeRun(existing as Record<string, unknown>)), { requestId });
        }
    }

    // Resolve tenant + installation scope.
    let tenantId: string | null = null;
    let installationId: string | null = null;
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
    } else if (body.tenant_id) {
        const raw = dePrefixId(body.tenant_id);
        const { data: tenant } = await supabase.from('platform_tenants').select('id, status').eq('project_id', validation.context.projectId).eq('id', raw).maybeSingle();
        const t = tenant ?? (await supabase.from('platform_tenants').select('id, status').eq('project_id', validation.context.projectId).eq('external_id', body.tenant_id).maybeSingle()).data;
        if (!t) return addGatewayHeaders(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }), { requestId });
        tenantId = (t.id as string);
    }

    const { data: insForVersion } = installationId
        ? await supabase.from('agent_installations').select('agent_version_id, update_channel').eq('id', installationId).maybeSingle()
        : { data: null };

    // Suspended tenants accept no new work (deletion/suspension propagation).
    if (tenantId) {
        const { data: tenantRow } = await supabase.from('platform_tenants').select('status').eq('id', tenantId).maybeSingle();
        if (!tenantRow || (tenantRow.status as string) !== 'active') {
            return addGatewayHeaders(embeddedError(403, 'tenant_suspended', 'Tenant is not active', { requestId }), { requestId });
        }
    }
    const runtime = await resolveAgentRuntimeConfig(supabase as never, {
        agentId,
        installationVersionId: ((insForVersion as { agent_version_id?: string | null } | null)?.agent_version_id as string | null) ?? null,
        updateChannel: ((insForVersion as { update_channel?: string | null } | null)?.update_channel as string | null) ?? null,
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
        const concurrency = await checkRunConcurrency(supabase as never, installationId, tenantId, tier);
        if (!concurrency.ok) {
            return addGatewayHeaders(embeddedError(429, concurrency.code, concurrency.message, { requestId }), { requestId });
        }
        const { checkSpendBudgets } = await import('@/lib/embedded/budgets');
        const budget = await checkSpendBudgets(supabase as never, { projectId: validation.context.projectId, tenantId, installationId, agentId });
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
            input_ref: (body.input ?? {}) as Record<string, unknown>,
            idempotency_key: idempotencyKey,
        })
        .select('*')
        .single();
    if (error || !run) {
        if (error?.code === '23505' && idempotencyKey) {
            const { data: existing } = await supabase.from('embedded_runs').select('*').eq('project_id', validation.context.projectId).eq('idempotency_key', idempotencyKey).maybeSingle();
            if (existing) return addGatewayHeaders(NextResponse.json(serializeRun(existing as Record<string, unknown>)), { requestId });
        }
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Failed to create run', { requestId }), { requestId });
    }
    const runRow = run as Record<string, unknown>;
    await appendRunEvent(supabase as never, runRow.id as string, 'run.queued', { run_id: runRow.id, mode });
    await emitEmbeddedEvent(validation.context.projectId, 'run.queued', { run_id: runRow.id, agent_id: agentId, mode });

    if (mode === 'sync') {
        await executeRun(runRow.id as string);
        const { data: done } = await supabase.from('embedded_runs').select('*').eq('id', runRow.id as string).single();
        return addGatewayHeaders(NextResponse.json(serializeRun((done ?? run) as Record<string, unknown>), { status: 201 }), { requestId });
    }
    void canTransition;
    waitUntil(executeRun(runRow.id as string));
    return addGatewayHeaders(NextResponse.json(serializeRun(runRow), { status: 202 }), { requestId });
}
