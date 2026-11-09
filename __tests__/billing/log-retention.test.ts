import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const access = vi.hoisted(() => ({ result: null as unknown }));
vi.mock('@/lib/require-project-access', () => ({ requireProjectAccess: vi.fn(async () => access.result) }));

// Records every created_at lower bound the export applies.
const gte = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabaseAdmin', () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['from', 'select', 'eq', 'in', 'is', 'lte', 'order', 'limit']) chain[m] = () => chain;
    chain.gte = (column: string, value: string) => { gte(column, value); return chain; };
    chain.range = async () => ({ data: [], error: null });
    chain.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
    return { createAdminClient: () => chain };
});

import { logRetentionCutoff } from '@/lib/entitlements';
import { GET } from '@/app/api/projects/[projectId]/export/route';

const DAY = 86_400_000;
const now = Date.parse('2026-11-09T12:00:00Z');

describe('logRetentionCutoff', () => {
    it('is 7 days on Free, 30 on Pro, 90 on Team, none on Enterprise', () => {
        expect(logRetentionCutoff('free', now)).toBe(new Date(now - 7 * DAY).toISOString());
        expect(logRetentionCutoff('pro', now)).toBe(new Date(now - 30 * DAY).toISOString());
        expect(logRetentionCutoff('team', now)).toBe(new Date(now - 90 * DAY).toISOString());
        expect(logRetentionCutoff('enterprise', now)).toBeNull();
    });
    it('treats an unknown plan as Free', () => {
        expect(logRetentionCutoff(null, now)).toBe(new Date(now - 7 * DAY).toISOString());
    });
});

describe('GET /api/projects/:id/export', () => {
    const call = (query = '') => GET(new NextRequest(`http://localhost/api/projects/p1/export?type=logs${query}`), { params: Promise.resolve({ projectId: 'p1' }) });

    beforeEach(() => gte.mockClear());

    it('refuses anyone who is not a member of the project', async () => {
        access.result = { ok: false, response: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };
        const res = await call();
        expect(res.status).toBe(404);
        expect(gte).not.toHaveBeenCalled();
    });

    it('exports a Free project only as far back as 7 days, even when asked for more', async () => {
        access.result = { ok: true, userId: 'u', organizationId: 'o', role: 'owner', subscriptionTier: 'free' };
        await call('&from=2020-01-01T00:00:00Z');
        const [, from] = gte.mock.calls.find(([column]) => column === 'created_at')!;
        expect(Date.now() - Date.parse(from as string)).toBeLessThanOrEqual(7 * DAY + 60_000);
    });

    it('lets Enterprise export all history', async () => {
        access.result = { ok: true, userId: 'u', organizationId: 'o', role: 'owner', subscriptionTier: 'enterprise' };
        await call();
        expect(gte).not.toHaveBeenCalled();
    });
});
