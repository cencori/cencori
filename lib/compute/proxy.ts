/**
 * Cencori Compute — runtime proxy.
 *
 * The dashboard never talks to an agent's *.fly.dev host directly. These helpers
 * resolve the agent's runtime base URL (behind the project-access guard) and
 * forward the Runtime Contract v2 calls (/runs, /runs/:id, /events, /cancel,
 * /resume). Keeping it same-origin means the browser's session cookie carries
 * auth and the agent's URL/key never reach the client.
 *
 * Local dev: set COMPUTE_RUNTIME_URL_OVERRIDE to a locally-running shim
 * (e.g. http://localhost:8080) to drive the timeline without a real deployment.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/compute/access';

type Resolved =
    | { ok: true; baseUrl: string }
    | { ok: false; response: NextResponse };

/** Auth-gate the caller and resolve the agent's runtime base URL. */
export async function resolveAgentBase(projectId: string, agentId: string): Promise<Resolved> {
    const gate = await requireProjectAccess(projectId);
    if (!gate.ok) return { ok: false, response: gate.response };

    const override = process.env.COMPUTE_RUNTIME_URL_OVERRIDE;
    if (override) return { ok: true, baseUrl: override.replace(/\/+$/, '') };

    const admin = createAdminClient();
    const { data: agent } = await admin
        .from('compute_agents')
        .select('hostname')
        .eq('id', agentId)
        .eq('project_id', projectId)
        .maybeSingle();

    if (!agent) {
        return { ok: false, response: NextResponse.json({ error: 'Agent not found' }, { status: 404 }) };
    }
    if (!agent.hostname) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: 'not_deployed', message: 'This agent has no running deployment yet.' },
                { status: 409 },
            ),
        };
    }
    return { ok: true, baseUrl: `https://${agent.hostname}` };
}

/** Forward a JSON contract call to the runtime and relay its response verbatim.
 *
 * Successes pass through untouched. Failures are normalized into a structured
 * envelope — { error, code, message, requestId, timestamp, upstream_status } —
 * so callers never have to parse free text (or an empty body) to tell a
 * runtime failure from a proxy failure. The runtime's own code/message are
 * preserved verbatim inside the envelope when present.
 */
export async function forwardJson(baseUrl: string, path: string, method: 'GET' | 'POST', body?: string): Promise<Response> {
    const requestId = `req_${crypto.randomUUID().slice(0, 8)}`;
    const timestamp = new Date().toISOString();
    let upstream: Response;
    try {
        upstream = await fetch(`${baseUrl}${path}`, {
            method,
            headers: body != null ? { 'content-type': 'application/json' } : undefined,
            body,
        });
    } catch {
        return NextResponse.json(
            {
                error: 'runtime_unreachable',
                code: 'runtime_unreachable',
                message: 'Could not reach the agent runtime.',
                requestId,
                timestamp,
            },
            { status: 502 },
        );
    }
    const text = await upstream.text();
    if (upstream.ok) {
        return new Response(text || '{}', {
            status: upstream.status,
            headers: { 'content-type': 'application/json' },
        });
    }
    let envelope: Record<string, unknown> | null = null;
    try {
        const parsed: unknown = text ? JSON.parse(text) : null;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            envelope = parsed as Record<string, unknown>;
        }
    } catch {
        envelope = null;
    }
    const code =
        typeof envelope?.code === 'string'
            ? envelope.code
            : typeof envelope?.error === 'string'
                ? envelope.error
                : `runtime_error_${upstream.status}`;
    const message =
        typeof envelope?.message === 'string'
            ? envelope.message
            : typeof envelope?.error === 'string' && envelope.error !== code
                ? envelope.error
                : `Agent runtime failed with status ${upstream.status}.`;
    return NextResponse.json(
        {
            error: code,
            code,
            message,
            requestId,
            timestamp,
            upstream_status: upstream.status,
        },
        { status: upstream.status },
    );
}
