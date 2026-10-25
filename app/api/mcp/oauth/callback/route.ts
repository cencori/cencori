/**
 * GET /api/mcp/oauth/callback?code=…&state=…
 *
 * Where an MCP server's sign-in sends the owner back. Finishes what the
 * studio's `mcp_oauth_start` began: checks it's the same signed-in owner,
 * exchanges the code (PKCE), stores the tokens in a project connection, lists
 * the server's tools and adds the server to the agent's draft. Runs in the
 * sign-in popup: it tells the console how it went and closes itself.
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { checksumConfig, type AgentVersionConfig } from '@/lib/embedded/agents';
import { buildAgentMcpServers, connectAgentMcpServer, readAgentMcpServers, type AgentMcpServer } from '@/lib/embedded/agent-mcp';
import { exchangeMcpCode, openMcpOAuthState, saveMcpConnection } from '@/lib/embedded/mcp-oauth';

type Outcome = { ok: true; name: string; on: number; total: number } | { ok: false; error: string };

/** A tiny page that hands the outcome to the console window and closes. */
function finish(outcome: Outcome): NextResponse {
    const nonce = crypto.randomBytes(16).toString('base64');
    const message = JSON.stringify({ type: 'cencori:mcp-oauth', ...outcome }).replace(/</g, '\\u003c');
    const text = outcome.ok ? `${outcome.name} is connected. You can close this window.` : outcome.error;
    const escaped = text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
    return new NextResponse(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${outcome.ok ? 'Connected' : 'Sign-in failed'}</title>`
        + '<style>html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;padding:24px;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;color:#555;text-align:center}</style></head>'
        + `<body><p>${escaped}</p><script nonce="${nonce}">try{if(window.opener){window.opener.postMessage(${message},window.location.origin);window.close();}}catch(e){}</script></body></html>`,
        {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store',
                'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
                'Referrer-Policy': 'no-referrer',
            },
        },
    );
}

export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams;
    const state = openMcpOAuthState(params.get('state') ?? '');
    if (!state) return finish({ ok: false, error: 'This sign-in link has expired. Close this window and try again.' });
    // Local sign-ins return to localhost (servers only allow http there); the
    // owner's session and the console window are on the console host. The
    // Host header says where the browser really is (nextUrl normalizes it in
    // dev), and the marker means a forwarded request is never forwarded again.
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
    if (state.returnOrigin && !params.has('forwarded') && host !== new URL(state.returnOrigin).host) {
        const forwarded = new URL(`${state.returnOrigin}${request.nextUrl.pathname}`);
        params.forEach((value, key) => forwarded.searchParams.set(key, value));
        forwarded.searchParams.set('forwarded', '1');
        return NextResponse.redirect(forwarded.toString());
    }
    if (params.get('error')) {
        return finish({ ok: false, error: params.get('error') === 'access_denied' ? 'Sign-in was cancelled.' : `The server refused the sign-in (${params.get('error_description') || params.get('error')}).` });
    }
    const code = params.get('code');
    if (!code) return finish({ ok: false, error: 'The server didn\'t send a sign-in code. Try again.' });

    // Only the owner who started the sign-in can finish it.
    const access = await requireProjectAccess(state.projectId);
    if (!access.ok || access.userId !== state.userId) return finish({ ok: false, error: 'Sign in to Cencori as the same user, then try again.' });

    const db = createAdminClient();
    const { data: version } = await db.from('agent_versions')
        .select('id, status, config_json')
        .eq('project_id', state.projectId)
        .eq('agent_id', state.agentId)
        .eq('id', state.versionId)
        .maybeSingle();
    if (!version || !['draft', 'ready_for_review'].includes(version.status as string)) {
        return finish({ ok: false, error: 'That draft was published or removed while you were signing in. Open a draft and try again.' });
    }
    const existing = (version.config_json ?? {}) as AgentVersionConfig;
    const stored = readAgentMcpServers(existing);
    // Signing in again to a stored server, or a server already on the draft by URL, updates it.
    const previous = (state.serverId ? stored.find((server) => server.id === state.serverId) : null)
        ?? stored.find((server) => server.url === state.url)
        ?? null;

    let connectionId: string;
    try {
        const tokens = await exchangeMcpCode(state, code);
        connectionId = await saveMcpConnection(db, { projectId: state.projectId, organizationId: state.organizationId, state, tokens, connectionId: previous?.oauth?.connection_id });
    } catch (error) {
        return finish({ ok: false, error: `Sign-in didn't complete: ${error instanceof Error ? error.message : 'the server refused the code'}.` });
    }

    const connected = await connectAgentMcpServer({
        url: state.url,
        organizationId: state.organizationId,
        previous,
        oauth: { connection_id: connectionId, issuer: new URL(state.issuer).host },
    });
    if (!connected.ok) return finish({ ok: false, error: `Signed in, but the server's tools couldn't be listed: ${connected.message}` });

    const servers: AgentMcpServer[] = previous
        ? stored.map((server) => (server.id === previous.id ? connected.server : server))
        : [...stored, connected.server];
    const built = buildAgentMcpServers(servers.map(({ id, name, enabled }) => ({ id, name, enabled })), stored, [connected.server]);
    if (!built.ok) return finish({ ok: false, error: built.message });
    const config: AgentVersionConfig = { ...existing, mcp_servers: built.servers };
    const { data: saved } = await db.from('agent_versions').update({
        config_json: config, checksum: checksumConfig(config), status: 'draft',
        last_tested_at: null, last_test_passed: false,
    }).eq('project_id', state.projectId).eq('agent_id', state.agentId).eq('id', state.versionId)
        .in('status', ['draft', 'ready_for_review']).select('id').maybeSingle();
    if (!saved) return finish({ ok: false, error: 'The draft changed while you were signing in. Try again.' });

    return finish({ ok: true, name: connected.server.name, on: connected.server.enabled.length, total: connected.server.tools.length });
}
