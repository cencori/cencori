import { NextResponse } from 'next/server';
import crypto from 'crypto';

/** Stable error envelope per PRD §10.5. */
export function embeddedError(
    status: number,
    code: string,
    message: string,
    opts: { requestId?: string; param?: string; type?: string } = {},
) {
    return NextResponse.json(
        {
            error: {
                type: opts.type ?? 'invalid_request_error',
                code,
                message,
                request_id: opts.requestId ?? `req_${crypto.randomUUID().slice(0, 8)}`,
                ...(opts.param ? { param: opts.param } : {}),
            },
        },
        { status },
    );
}

export function getIdempotencyKey(headers: Headers): string | null {
    const v = headers.get('Idempotency-Key')?.trim();
    return v ? v : null;
}

export function parseCursorPagination(searchParams: URLSearchParams): { limit: number; cursor: string | null } {
    const raw = Number.parseInt(searchParams.get('limit') ?? '20', 10);
    const limit = Number.isFinite(raw) ? Math.min(100, Math.max(1, raw)) : 20;
    return { limit, cursor: searchParams.get('cursor') };
}

export function cursorPaginate<T extends { id: string }>(rows: T[], limit: number): { data: T[]; next_cursor: string | null } {
    if (rows.length <= limit) return { data: rows, next_cursor: null };
    return { data: rows.slice(0, limit), next_cursor: rows[limit - 1].id };
}

/** UUID passthrough that also accepts ten_/usr_/prc_/pms_ prefixed aliases. */
export function dePrefixId(value: string): string {
    return value.replace(/^(ten_|usr_|prc_|pms_|ins_|ses_|run_|act_|kb_|src_|con_)/, '');
}

export function withPrefix(prefix: string, id: string): string {
    if (id.startsWith(`${prefix}_`)) return id;
    return `${prefix}_${id}`;
}

/**
 * Control-plane authorization (blocker fix): only secret project keys
 * (`csk_*`, keyType `secret`) may call embedded management APIs. Rejects
 * publishable keys, agent keys, dashboard keys, and anything else.
 * Client-token (`ect_`) paths never reach this helper — they authenticate
 * through verified claims instead.
 */
export function requireSecretKey(
    context: { keyType?: string | null },
    requestId: string,
): NextResponse | null {
    if (context.keyType !== 'secret') {
        return embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId });
    }
    return null;
}
