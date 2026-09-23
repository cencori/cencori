import type { createAdminClient } from '@/lib/supabaseAdmin';
import type { SubscriptionTier } from '@/lib/entitlements';
import { resolveAgentRuntimeConfig } from './agents';
import { normalizeManifest } from './manifest';
import { appendRunEvent, emitEmbeddedEvent } from './runs';
import { dePrefixId } from './http';

type Admin = ReturnType<typeof createAdminClient>;

export interface DelegationInput {
    parentRunId: string;
    childVersionId: string;
    input: unknown;
    /** Optional explicit installation for the child (validated below). */
    installationId?: string | null;
    idempotencyKey?: string | null;
}

export interface DelegationResult {
    childRunId: string;
    status: string;
    output: unknown;
}

/** Walk the parent chain collecting ancestor version IDs (bounded). */
async function ancestorVersionIds(supabase: Admin, runId: string): Promise<Set<string>> {
    const seen = new Set<string>();
    let current: string | null = runId;
    for (let i = 0; i < 10 && current; i++) {
        const { data } = await supabase.from('embedded_runs').select('id, agent_version_id, parent_run_id').eq('id', current).maybeSingle();
        const row = data as { id: string; agent_version_id: string | null; parent_run_id: string | null } | null;
        if (!row) break;
        if (row.agent_version_id) seen.add(row.agent_version_id);
        current = row.parent_run_id;
    }
    return seen;
}

async function cancelDescendant(supabase: Admin, runId: string, projectId: string): Promise<void> {
    const { data } = await supabase.from('embedded_runs').select('id').eq('parent_run_id', runId).not('status', 'in', '(completed,failed,cancelled,expired)');
    for (const child of (data ?? []) as Array<{ id: string }>) {
        const { data: claimed, error } = await supabase.from('embedded_runs')
            .update({ status: 'cancelled', completed_at: new Date().toISOString() })
            .eq('id', child.id).eq('project_id', projectId)
            .in('status', ['queued', 'running', 'requires_action']).select('id').maybeSingle();
        if (error) throw new Error(`Failed to cancel child run: ${error.message}`);
        if (claimed) await appendRunEvent(supabase, child.id, 'run.cancelled', { run_id: child.id, cascade_from: runId });
        await cancelDescendant(supabase, child.id, projectId);
    }
}

/** Propagate cancellation to active descendants (parent cancel, tenant suspend, expiry). */
export async function cancelChildRuns(supabase: Admin, parentRunId: string, projectId: string): Promise<void> {
    await cancelDescendant(supabase, parentRunId, projectId);
}

/**
 * Delegate one bounded task to an explicitly referenced subagent version.
 * The child runs isolated: same project/tenant/user, an explicitly bound
 * child installation (or none), its own version config, no parent conversation beyond the
 * explicit task input. Credentials resolve per the child's own bindings.
 */
export async function delegateSubagent(
    supabase: Admin,
    opts: { projectId: string; organizationId: string; tier: SubscriptionTier } & DelegationInput,
): Promise<DelegationResult> {
    const parentId = dePrefixId(opts.parentRunId);
    const childVersionId = dePrefixId(opts.childVersionId);

    const { data: parentRow } = await supabase.from('embedded_runs').select('*').eq('project_id', opts.projectId).eq('id', parentId).maybeSingle();
    if (!parentRow) throw Object.assign(new Error('Parent run not found'), { status: 404 });
    const parent = parentRow as {
        id: string; status: string; tenant_id: string | null; external_user_id: string | null;
        agent_id: string; agent_version_id: string | null; installation_id: string | null;
        session_id: string | null; delegation_depth: number | null; input_ref: unknown;
    };
    if (['completed', 'failed', 'cancelled', 'expired'].includes(parent.status)) {
        throw Object.assign(new Error(`Parent run is ${parent.status}`), { status: 409 });
    }

    // Tenant suspension propagates: no new child work for suspended tenants.
    if (parent.tenant_id) {
        const { data: tenant } = await supabase.from('platform_tenants').select('status').eq('id', parent.tenant_id).maybeSingle();
        if (!tenant || (tenant.status as string) !== 'active') {
            throw Object.assign(new Error('Tenant is not active'), { status: 403, code: 'tenant_suspended' });
        }
    }
    if (!parent.agent_version_id) {
        throw Object.assign(new Error('Parent run has no resolved agent version; delegation requires a published manifest'), { status: 409 });
    }

    // Parent manifest: depth budget + edge allowlist.
    const { data: parentVersion } = await supabase.from('agent_versions').select('config_json').eq('id', parent.agent_version_id).maybeSingle();
    const manifest = normalizeManifest(((parentVersion as { config_json?: Record<string, unknown> } | null)?.config_json ?? {}) as Record<string, unknown>);
    const depth = parent.delegation_depth ?? 0;
    if (depth + 1 > manifest.policy.max_delegation_depth) {
        throw Object.assign(new Error(`Delegation depth exceeded (max ${manifest.policy.max_delegation_depth})`), { status: 403 });
    }
    // Plan-level ceiling sits above manifest policy.
    const { getEmbeddedLimits } = await import('@/lib/entitlements');
    const tierCap = getEmbeddedLimits(opts.tier).maxDelegationDepth;
    if (depth + 1 > tierCap) {
        throw Object.assign(new Error(`Delegation depth exceeded for this plan (max ${tierCap})`), { status: 403 });
    }
    const { data: edge } = await supabase
        .from('agent_version_subagents')
        .select('max_calls, timeout_ms, budget_limit')
        .eq('parent_agent_version_id', parent.agent_version_id)
        .eq('child_agent_version_id', childVersionId)
        .maybeSingle();
    if (!edge) {
        throw Object.assign(new Error('Subagent version is not in the parent manifest allowlist'), { status: 403 });
    }
    // Note: max_calls/timeout/budget enforcement lives in the atomic claim
    // RPC below; this read is a fast-fail only and never a limit decision.

    // Child version must exist in-project and be published; ancestry walk blocks indirect cycles.
    const { data: childVersion } = await supabase
        .from('agent_versions')
        .select('id, agent_id, status, config_json, agents!inner(id, project_id)')
        .eq('id', childVersionId)
        .eq('agents.project_id', opts.projectId)
        .maybeSingle();
    if (!childVersion || (childVersion.status as string) !== 'published') {
        throw Object.assign(new Error('Child agent version is not published in this project'), { status: 409 });
    }
    const childAgentId = (childVersion.agent_id as string);
    const ancestors = await ancestorVersionIds(supabase, parent.id);
    if (ancestors.has(childVersionId)) {
        throw Object.assign(new Error('Delegation would create a cycle'), { status: 409 });
    }

    // Isolated child context: the child NEVER inherits the parent's
    // installation or session. An installation may be bound explicitly, and
    // only when it belongs to this project and tenant and serves the CHILD
    // agent. Sessions are never inherited — the child run stands alone.
    let childInstallationId: string | null = null;
    if (opts.installationId) {
        const { data: childIns } = await supabase
            .from('agent_installations')
            .select('id, tenant_id, agent_id, status')
            .eq('project_id', opts.projectId)
            .eq('id', dePrefixId(opts.installationId))
            .maybeSingle();
        if (!childIns) throw Object.assign(new Error('Installation not found in this project'), { status: 404 });
        if ((childIns.status as string) !== 'active') throw Object.assign(new Error('Installation is not active'), { status: 409 });
        if ((childIns.tenant_id as string) !== parent.tenant_id) {
            throw Object.assign(new Error('Installation does not belong to this tenant'), { status: 403 });
        }
        if ((childIns.agent_id as string) !== childAgentId) {
            throw Object.assign(new Error('Installation does not serve the child agent'), { status: 403 });
        }
        childInstallationId = (childIns.id as string);
    }

    // Charge admission to the child's installation and tenant, not the
    // parent's installation: ai_requests is attributed to this same scope.
    const { checkSpendBudgets } = await import('./budgets');
    const budget = await checkSpendBudgets(supabase, {
        projectId: opts.projectId,
        tenantId: parent.tenant_id,
        installationId: childInstallationId,
        agentId: childAgentId,
    });
    if (!budget.ok) throw Object.assign(new Error(`${budget.scope} spend budget exceeded`), { status: 402 });

    // The database locks the parent and atomically enforces max_calls,
    // installation/tenant ownership, and retry identity before inserting.
    const { data: claim, error: claimError } = await supabase.rpc('claim_embedded_subagent_run', {
        p_project_id: opts.projectId,
        p_parent_run_id: parent.id,
        p_child_version_id: childVersionId,
        p_child_installation_id: childInstallationId,
        p_input: (opts.input ?? {}) as Record<string, unknown>,
        p_idempotency_key: opts.idempotencyKey ?? null,
    });
    if (claimError || !claim) {
        const message = claimError?.message ?? 'Failed to claim subagent run';
        const status = message.includes('subagent_call_budget_exhausted') || message.includes('subagent_budget_busy') ? 429
            : message.includes('subagent_billing_reconciliation_required') ? 409
            : message.includes('subagent_spend_budget_exhausted') ? 402
            : message.includes('idempotency_conflict') ? 409
                : message.includes('parent_run_not_found') ? 404
                    : message.includes('tenant_suspended') || message.includes('child_installation_scope_mismatch') ? 403
                        : message.includes('parent_run_inactive') || message.includes('child_version_unavailable') ? 409 : 500;
        throw Object.assign(new Error(message), { status, code: status === 409 && message.includes('idempotency_conflict') ? 'idempotency_conflict' : 'invalid_request_error' });
    }
    const claimedRun = claim as { id: string; status: string; output: unknown; created: boolean; timeout_ms?: number | null };
    if (!claimedRun.created) return { childRunId: claimedRun.id, status: claimedRun.status, output: claimedRun.output ?? null };
    const childId = claimedRun.id;
    // The deadline comes from the atomic claim, not the stale pre-read: the
    // edge may have been republished between the fast-fail check and now.
    const claimTimeoutMs = typeof claimedRun.timeout_ms === 'number' && claimedRun.timeout_ms > 0 ? claimedRun.timeout_ms : null;

    await appendRunEvent(supabase, parent.id, 'subagent.called', { parent_run_id: parent.id, child_run_id: childId, child_version_id: childVersionId });
    await appendRunEvent(supabase, childId, 'run.queued', { run_id: childId, parent_run_id: parent.id });
    await emitEmbeddedEvent(opts.projectId, 'subagent.called', { parent_run_id: parent.id, child_run_id: childId });

    // Execute the child inline (bounded by the provider timeout).
    const claimed = await supabase.from('embedded_runs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', childId).eq('status', 'queued').select('id').maybeSingle();
    if (!claimed.data) return { childRunId: childId, status: 'queued', output: null };
    await appendRunEvent(supabase, childId, 'run.started', { run_id: childId });

    let attemptedModel: string | null = null;
    let timedOut = false;
    let usageRecorded = false;
    let reconciliationReason: string | null = null;
    let appliedTimeoutMs = 120000;
    try {
        const runtime = await resolveAgentRuntimeConfig(supabase, { agentId: (childVersion.agent_id as string), installationVersionId: childVersionId });
        const config = (runtime.config ?? {}) as { model?: string; instructions?: string; system_prompt?: string; temperature?: number; max_output_tokens?: number };
        if (!config.model?.trim()) throw new Error('Child agent has no model configured');
        attemptedModel = config.model;

        let contextBlock: string | null = null;
        // Only explicitly bound child bindings load knowledge — never the
        // parent's installation context.
        if (childInstallationId) {
            const { retrieveTurnKnowledge } = await import('./turn-knowledge');
            const kb = await retrieveTurnKnowledge(supabase, {
                projectId: opts.projectId,
                organizationId: opts.organizationId,
                installationId: childInstallationId,
                queryText: JSON.stringify(opts.input ?? {}).slice(0, 2000),
            });
            contextBlock = kb.block;
        }

        const { executeGatewayChat } = await import('@/lib/gateway/chat-executor');
        // Abort the provider request at the edge deadline; providers still may
        // bill a request already received, so timeout failures are marked for
        // billing reconciliation rather than assumed to cost zero.
        const timeoutMs = claimTimeoutMs ? Math.min(claimTimeoutMs, 600000) : 120000;
        appliedTimeoutMs = timeoutMs;
        const controller = new AbortController();
        const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
        let response: Awaited<ReturnType<typeof executeGatewayChat>>;
        try {
            response = await executeGatewayChat({
                supabase,
                projectId: opts.projectId,
                organizationId: opts.organizationId,
                tier: opts.tier,
                request: {
                    messages: [
                        ...(config.instructions || config.system_prompt ? [{ role: 'system' as const, content: (config.instructions ?? config.system_prompt) as string }] : []),
                        ...(contextBlock ? [{ role: 'system' as const, content: contextBlock }] : []),
                        { role: 'user' as const, content: JSON.stringify({ delegated_task: opts.input ?? {} }).slice(0, 4000) },
                    ],
                    model: config.model,
                    signal: controller.signal,
                    temperature: config.temperature ?? undefined,
                    maxTokens: config.max_output_tokens ?? undefined,
                },
                requestId: `sub_${childId.slice(0, 8)}`,
                singleProviderAttempt: true,
            });
        } finally {
            clearTimeout(timer);
        }

        const output = { output: response.content, model: response.model, child_version_id: childVersionId, usage: response.usage };
        // Meter the provider call even if cancellation wins the completion
        // race. A completed provider request is never free merely because the
        // child output was discarded.
        const { error: usageError } = await supabase.from('ai_requests').insert({
            project_id: opts.projectId, api_key_id: null, environment: 'production', endpoint: 'runs.delegate',
            model: response.model, provider: response.provider, status: 'success',
            prompt_tokens: response.usage.promptTokens, completion_tokens: response.usage.completionTokens, total_tokens: response.usage.totalTokens,
            cost_usd: response.cost.cencoriChargeUsd, provider_cost_usd: response.cost.providerCostUsd, cencori_charge_usd: response.cost.cencoriChargeUsd,
            markup_percentage: response.cost.markupPercentage,
            tenant_id: parent.tenant_id, agent_id: childAgentId, installation_id: childInstallationId,
            run_id: childId, request_id: `sub_${childId.slice(0, 8)}`, request_payload: {},
        });
        if (usageError) {
            reconciliationReason = 'metering_failure';
            throw new Error(`Failed to record subagent usage: ${usageError.message}`);
        }
        usageRecorded = true;
        if (timedOut) throw new Error('Subagent model completed after its deadline');
        const { data: done } = await supabase.from('embedded_runs').update({ status: 'completed', output_ref: output, completed_at: new Date().toISOString() }).eq('id', childId).eq('status', 'running').select('id').maybeSingle();
        if (done) {
            await appendRunEvent(supabase, childId, 'run.completed', { run_id: childId });
            await appendRunEvent(supabase, parent.id, 'subagent.completed', { parent_run_id: parent.id, child_run_id: childId });
            await emitEmbeddedEvent(opts.projectId, 'subagent.completed', { parent_run_id: parent.id, child_run_id: childId });
            return { childRunId: childId, status: 'completed', output };
        }
        return { childRunId: childId, status: 'cancelled', output: null };
    } catch (e) {
        const message = timedOut ? `Subagent execution timed out after ${appliedTimeoutMs}ms` : e instanceof Error ? e.message : 'Subagent failed';
        if (!usageRecorded && /\btimed out after \d+ms\b/.test(message)) reconciliationReason = 'provider_timeout';
        if (timedOut && !usageRecorded) reconciliationReason = 'provider_timeout';
        if (reconciliationReason && attemptedModel) {
            const { error: reconciliationError } = await supabase.from('ai_requests').insert({
                project_id: opts.projectId, api_key_id: null, environment: 'production', endpoint: 'runs.delegate',
                model: attemptedModel, provider: 'unknown', status: 'error',
                prompt_tokens: 0, completion_tokens: 0, total_tokens: 0,
                cost_usd: 0, provider_cost_usd: 0, cencori_charge_usd: 0, markup_percentage: 0,
                tenant_id: parent.tenant_id, agent_id: childAgentId, installation_id: childInstallationId,
                run_id: childId, request_id: `sub_${childId.slice(0, 8)}`, request_payload: {},
                metadata: { billing_reconciliation_required: true, reason: reconciliationReason },
            });
            if (reconciliationError) console.error('[Embedded subagents] Reconciliation row insert failed:', reconciliationError.message);
        }
        const errorText = reconciliationReason ? `billing_reconciliation_required:${reconciliationReason}; ${message}` : message;
        const { data: failed } = await supabase.from('embedded_runs').update({ status: 'failed', error: errorText.slice(0, 1000), completed_at: new Date().toISOString() }).eq('id', childId).eq('status', 'running').select('id').maybeSingle();
        if (!failed && reconciliationReason) {
            // Cancellation must keep its terminal status but still retain the
            // uncertain-charge marker when provider billing is unresolved.
            await supabase.from('embedded_runs').update({ error: errorText.slice(0, 1000) }).eq('id', childId).eq('status', 'cancelled');
        }
        if (failed) {
            await appendRunEvent(supabase, childId, 'run.failed', { run_id: childId, billing_reconciliation_required: Boolean(reconciliationReason) });
            await appendRunEvent(supabase, parent.id, 'subagent.failed', { parent_run_id: parent.id, child_run_id: childId, error: message.slice(0, 300) });
            await emitEmbeddedEvent(opts.projectId, 'subagent.failed', { parent_run_id: parent.id, child_run_id: childId });
        }
        throw Object.assign(new Error(message), { status: 502 });
    }
}
