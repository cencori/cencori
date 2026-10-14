import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { extractBearerToken } from '@/lib/api-keys';
import { embeddedError } from '@/lib/embedded/http';
import { isExportKey, verifyExportKey } from '@/lib/finops/export-keys';
import { FOCUS_VERSION, focusRecordsToCsv, isSubAccountMode, type SubAccountMode } from '@/lib/finops/focus';
import {
    FOCUS_PAGE_SIZE,
    loadOrganizationIdentity,
    parseFocusWindow,
    readFocusPage,
    resolveScopeProjectIds,
} from '@/lib/finops/usage-source';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

function encodeCursor(offset: number): string {
    return Buffer.from(JSON.stringify({ o: offset })).toString('base64url');
}

function decodeCursor(cursor: string | null): number | null {
    if (!cursor) return 0;
    try {
        const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { o?: unknown };
        return Number.isInteger(parsed.o) && (parsed.o as number) >= 0 ? (parsed.o as number) : null;
    } catch {
        return null;
    }
}

/**
 * GET /v1/usage/focus — usage as FOCUS 1.2 records, for FinOps tools.
 *
 * Auth, either:
 *   - an organization usage export key (`cuk_…`, Settings ▸ Advanced ▸ Usage export): every
 *     project in the organization, optionally narrowed with `project_id`. Read-only.
 *   - a project secret key: that project only.
 *
 * Query: `start`, `end` (RFC 3339 or YYYY-MM-DD, default yesterday UTC, ≤ 92 days),
 * `sub_account` (project | end_user | tenant | none, default project), `format` (json | csv),
 * `limit` (≤ 5000), `cursor`.
 */
export async function GET(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const url = new URL(req.url);
    const fail = (status: number, code: string, message: string, param?: string) =>
        addGatewayHeaders(embeddedError(status, code, message, { requestId, param }), { requestId });

    const supabase = createAdminClient();
    const bearer = extractBearerToken(req.headers.get('authorization'));

    let organizationId: string;
    let projectFilter: string | null = url.searchParams.get('project_id');

    if (isExportKey(bearer)) {
        const verified = await verifyExportKey(supabase, bearer);
        if (!verified) return fail(401, 'invalid_api_key', 'This usage export key is invalid or has been revoked');
        organizationId = verified.organizationId;
    } else {
        const validation = await validateGatewayRequest(req);
        if (!validation.success) return validation.response;
        if (validation.context.keyType !== 'secret') {
            return fail(403, 'secret_key_required', 'This operation requires a secret project key or a usage export key');
        }
        if (projectFilter && projectFilter !== validation.context.projectId) {
            return fail(403, 'project_forbidden', 'A project key can only read its own project', 'project_id');
        }
        organizationId = validation.context.organizationId;
        projectFilter = validation.context.projectId;
    }

    const window = parseFocusWindow(url.searchParams.get('start'), url.searchParams.get('end'));
    if ('error' in window) return fail(400, 'invalid_request_error', window.error, 'start');

    const subAccountRaw = url.searchParams.get('sub_account') ?? 'project';
    if (!isSubAccountMode(subAccountRaw)) {
        return fail(400, 'invalid_request_error', 'sub_account must be one of project, end_user, tenant, none', 'sub_account');
    }
    const subAccount: SubAccountMode = subAccountRaw;

    const format = (url.searchParams.get('format') ?? 'json').toLowerCase();
    if (format !== 'json' && format !== 'csv') {
        return fail(400, 'invalid_request_error', 'format must be json or csv', 'format');
    }

    const limitRaw = url.searchParams.get('limit');
    const limit = limitRaw === null ? FOCUS_PAGE_SIZE : Number.parseInt(limitRaw, 10);
    if (!Number.isInteger(limit) || limit < 1 || limit > FOCUS_PAGE_SIZE) {
        return fail(400, 'invalid_request_error', `limit must be between 1 and ${FOCUS_PAGE_SIZE}`, 'limit');
    }
    const offset = decodeCursor(url.searchParams.get('cursor'));
    if (offset === null) return fail(400, 'invalid_request_error', 'cursor is malformed', 'cursor');

    try {
        const [organization, projectIds] = await Promise.all([
            loadOrganizationIdentity(supabase, organizationId),
            resolveScopeProjectIds(supabase, { organizationId, projectId: projectFilter }),
        ]);
        if (projectFilter && projectIds.length === 0) {
            return fail(404, 'project_not_found', 'No such project in this organization', 'project_id');
        }

        const page = await readFocusPage(supabase, {
            organization,
            projectIds,
            start: window.start,
            end: window.end,
            subAccount,
            limit,
            offset,
        });
        const nextCursor = page.hasMore ? encodeCursor(page.nextOffset) : null;

        if (format === 'csv') {
            const headers: Record<string, string> = {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="cencori-focus-${window.start.slice(0, 10)}-${window.end.slice(0, 10)}.csv"`,
            };
            if (nextCursor) headers['X-Next-Cursor'] = nextCursor;
            return addGatewayHeaders(new NextResponse(focusRecordsToCsv(page.records), { headers }), { requestId });
        }

        return addGatewayHeaders(NextResponse.json({
            object: 'list',
            focus_version: FOCUS_VERSION,
            charge_period_start: window.start,
            charge_period_end: window.end,
            sub_account: subAccount,
            data: page.records,
            has_more: page.hasMore,
            next_cursor: nextCursor,
        }), { requestId });
    } catch (error) {
        console.error(`[Usage FOCUS] ${requestId} failed:`, error);
        return fail(500, 'internal_error', 'Usage export failed');
    }
}
