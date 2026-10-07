import { describe, expect, it, vi } from 'vitest';
import { encryptApiKey } from '@/lib/encryption';

vi.mock('@/lib/providers/openai', () => ({
    OpenAIProvider: class {
        constructor(public apiKey?: string) {}
    },
    openAIReasoningEffort: () => undefined,
}));
vi.mock('@/lib/providers/gemini', () => ({ GeminiProvider: class {} }));
vi.mock('@/lib/providers/anthropic', () => ({ AnthropicProvider: class {} }));
vi.mock('@/lib/providers/cohere', () => ({ CohereProvider: class {} }));
vi.mock('@/lib/providers/openai-compatible', () => ({
    OpenAICompatibleProvider: class {},
    isOpenAICompatible: () => false,
}));
import {
    applyPinnedConnection,
    canMirrorProvider,
    indexEmbeddedConnections,
    mirrorConnectionsToKeys,
    mirrorKeysToConnections,
    pickEmbeddedFallbackRow,
    registerByokKey,
    resolveProviderKey,
    resolveProviderKeyRow,
} from '@/lib/providers/byok-store';
import { validatePinnedConnection } from '@/lib/embedded/manifest';

interface LoggedCall {
    op: string;
    table: string;
    args?: unknown;
}

// Chainable fake: every builder method returns the chain itself (awaiting it
// is harmless); only maybeSingle/limit resolve canned data.
function fakeDb(scenarios: { keysSingle?: unknown; connectionsList?: unknown[] }) {
    const log: LoggedCall[] = [];
    const makeChain = (table: string): Record<string, unknown> => {
        const chain: Record<string, unknown> = {};
        const self = () => chain;
        Object.assign(chain, {
            select: (...args: unknown[]) => (log.push({ op: 'select', table, args }), chain),
            eq: self,
            is: self,
            not: self,
            order: self,
            in: (...args: unknown[]) => (log.push({ op: 'in', table, args }), chain),
            upsert: (payload: unknown) => (log.push({ op: 'upsert', table, args: payload }), chain),
            update: (payload: unknown) => (log.push({ op: 'update', table, args: payload }), chain),
            delete: () => (log.push({ op: 'delete', table }), chain),
            insert: (payload: unknown) => (log.push({ op: 'insert', table, args: payload }), chain),
            maybeSingle: async () => ({
                data: table === 'provider_keys' ? (scenarios.keysSingle ?? null) : null,
                error: null,
            }),
            limit: async () => ({
                data: table === 'provider_connections' ? (scenarios.connectionsList ?? []) : [],
                error: null,
            }),
        });
        return chain;
    };
    return { log, client: { from: (table: string) => makeChain(table) } };
}

describe('embedded picker', () => {
    it('returns null when nothing is usable', () => {
        expect(pickEmbeddedFallbackRow([])).toBeNull();
        expect(
            pickEmbeddedFallbackRow([
                { provider: 'openai', status: 'unhealthy', base_url: null, encrypted_key_ref: 'k' },
                { provider: 'openai', status: 'active', base_url: null, encrypted_key_ref: null },
                { provider: 'openai', status: 'active', base_url: 'https://proxy.example.com/v1', encrypted_key_ref: 'k' },
                { provider: 'openai', status: 'disabled', base_url: null, encrypted_key_ref: 'k' },
            ]),
        ).toBeNull();
    });

    it('picks the newest active managed-endpoint row', () => {
        const winner = pickEmbeddedFallbackRow([
            { id: 'old', provider: 'openai', status: 'active', base_url: null, encrypted_key_ref: 'k1', created_at: '2026-09-25T23:00:47Z' },
            { id: 'new', provider: 'openai', status: 'active', base_url: null, encrypted_key_ref: 'k2', created_at: '2026-09-25T23:35:39Z' },
        ]);
        expect(winner?.id).toBe('new');
    });

    it('indexes the newest usable connection per provider', () => {
        const index = indexEmbeddedConnections([
            { id: 'a', provider: 'OpenAI', status: 'active', base_url: null, encrypted_key_ref: 'k' },
            { id: 'b', provider: 'anthropic', status: 'active', base_url: null, encrypted_key_ref: null },
        ]);
        expect(index.get('openai')?.id).toBe('a');
        expect(index.has('anthropic')).toBe(false);
    });
});

describe('unified reads', () => {
    it('prefers the active dashboard key', async () => {
        const { client } = fakeDb({
            keysSingle: { encrypted_key: encryptApiKey('sk-dash', 'org-1'), key_hint: '...dash', is_active: true, default_model: 'gpt-1' },
            connectionsList: [
                { id: 'c1', provider: 'openai', status: 'active', base_url: null, encrypted_key_ref: encryptApiKey('sk-api', 'org-1'), created_at: '2026-09-26T00:00:00Z' },
            ],
        });
        const row = await resolveProviderKeyRow(client as never, { projectId: 'p', provider: 'openai' });
        expect(row?.source).toBe('dashboard');
        const resolved = await resolveProviderKey(client as never, { projectId: 'p', organizationId: 'org-1', provider: 'openai' });
        expect(resolved?.apiKey).toBe('sk-dash');
        expect(resolved?.defaultModel).toBe('gpt-1');
    });

    it('falls back to the embedded connection when no dashboard key exists', async () => {
        const { client } = fakeDb({
            keysSingle: null,
            connectionsList: [
                { id: 'c1', provider: 'openai', status: 'active', base_url: null, encrypted_key_ref: encryptApiKey('sk-api', 'org-1'), key_hint: '...pi', created_at: '2026-09-25T23:00:47Z' },
            ],
        });
        const resolved = await resolveProviderKey(client as never, { projectId: 'p', organizationId: 'org-1', provider: 'openai' });
        expect(resolved?.source).toBe('api');
        expect(resolved?.apiKey).toBe('sk-api');
    });

    it('returns null when neither store has a usable key', async () => {
        const { client } = fakeDb({ keysSingle: null, connectionsList: [] });
        await expect(
            resolveProviderKey(client as never, { projectId: 'p', organizationId: 'org-1', provider: 'openai' }),
        ).resolves.toBeNull();
    });
});

describe('mirror: connections -> keys', () => {
    it('upserts the newest embedded key without touching default models', async () => {
        const { log, client } = fakeDb({
            connectionsList: [
                { encrypted_key_ref: 'CIPH-A', key_hint: '...AA', created_at: '2026-09-25T23:00:47Z' },
                { encrypted_key_ref: 'CIPH-B', key_hint: '...BB', created_at: '2026-09-25T23:35:39Z' },
            ],
        });
        await mirrorConnectionsToKeys(client as never, { projectId: 'p', organizationId: 'org-1', provider: 'openai' });
        const upsert = log.find((c) => c.op === 'upsert' && c.table === 'provider_keys');
        expect(upsert?.args).toMatchObject({ project_id: 'p', provider: 'openai', encrypted_key: 'CIPH-B', key_hint: '...BB', is_active: true });
        expect(upsert?.args).not.toHaveProperty('default_model');
    });

    it('removes the mirrored dashboard row when no usable connection remains', async () => {
        const { log, client } = fakeDb({ connectionsList: [] });
        await mirrorConnectionsToKeys(client as never, { projectId: 'p', organizationId: 'org-1', provider: 'openai' });
        expect(log.some((c) => c.op === 'delete' && c.table === 'provider_keys')).toBe(true);
    });

    it('skips vendors outside the keys-table constraint', async () => {
        expect(canMirrorProvider('maximo')).toBe(true);
        expect(canMirrorProvider('cerebras')).toBe(true);
        expect(canMirrorProvider('deepgram')).toBe(true);
        expect(canMirrorProvider('openai')).toBe(true);
        expect(canMirrorProvider('not-a-vendor')).toBe(false);
        const { log, client } = fakeDb({
            connectionsList: [{ encrypted_key_ref: 'K', created_at: '2026-09-25T23:00:47Z' }],
        });
        await mirrorConnectionsToKeys(client as never, { projectId: 'p', organizationId: 'org-1', provider: 'not-a-vendor' });
        expect(log.filter((c) => c.table === 'provider_keys')).toHaveLength(0);
    });
});

describe('mirror: keys -> connections', () => {    it('updates the primary embedded connection in place', async () => {
        const { log, client } = fakeDb({
            keysSingle: { encrypted_key: 'CIPH-NEW', key_hint: '...EW', is_active: true },
            connectionsList: [
                { id: 'c-old', status: 'active', base_url: null, encrypted_key_ref: 'CIPH-OLD', created_at: '2026-09-25T23:00:47Z' },
            ],
        });
        await mirrorKeysToConnections(client as never, { projectId: 'p', organizationId: 'org-1', provider: 'openai', displayName: 'OpenAI' });
        const update = log.find((c) => c.op === 'update' && c.table === 'provider_connections');
        expect(update?.args).toMatchObject({ encrypted_key_ref: 'CIPH-NEW', status: 'active' });
        expect(log.some((c) => c.op === 'insert')).toBe(false);
    });

    it('inserts a managed connection when none exists', async () => {
        const { log, client } = fakeDb({
            keysSingle: { encrypted_key: 'CIPH-NEW', key_hint: '...EW', is_active: true },
            connectionsList: [],
        });
        await mirrorKeysToConnections(client as never, { projectId: 'p', organizationId: 'org-1', provider: 'anthropic', displayName: 'Anthropic' });
        const insert = log.find((c) => c.op === 'insert' && c.table === 'provider_connections');
        expect(insert?.args).toMatchObject({ provider: 'anthropic', api_format: 'anthropic', base_url: null, status: 'active' });
    });

    it('disables embedded rows when the dashboard key is removed', async () => {
        const { log, client } = fakeDb({
            keysSingle: null,
            connectionsList: [
                { id: 'c1', status: 'active', base_url: null, encrypted_key_ref: 'K', created_at: '2026-09-25T23:00:47Z' },
                { id: 'c2', status: 'active', base_url: 'https://proxy.example.com/v1', encrypted_key_ref: 'K', created_at: '2026-09-25T23:00:47Z' },
            ],
        });
        await mirrorKeysToConnections(client as never, { projectId: 'p', organizationId: 'org-1', provider: 'openai', displayName: 'OpenAI' });
        const update = log.find((c) => c.op === 'update' && c.table === 'provider_connections');
        expect(update?.args).toEqual({ status: 'disabled' });
    });
});

describe('pinned connections', () => {
    const pinRow = (overrides: Record<string, unknown> = {}) => ({
        id: 'conn-1',
        provider: 'openai',
        status: 'active',
        base_url: null,
        encrypted_key_ref: encryptApiKey('sk-pinned', 'org-1'),
        key_hint: '...ned',
        ...overrides,
    });
    const pinDb = (row: Record<string, unknown> | null) => ({
        from: () => ({
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }),
        }),
    });
    const router = () => {
        const calls: unknown[][] = [];
        return {
            calls,
            registerProvider: (...args: unknown[]) => { calls.push(args); },
        };
    };

    it('validates pins against project, status, key, endpoint, and model', async () => {
        const good = await validatePinnedConnection(pinDb(pinRow()) as never, 'proj-1', 'prc_conn-1', 'gpt-4o');
        expect(good.errors).toEqual([]);

        const missing = await validatePinnedConnection(pinDb(null) as never, 'proj-1', 'prc_nope', 'gpt-4o');
        expect(missing.errors.some((e) => e.includes('not found'))).toBe(true);

        const inactive = await validatePinnedConnection(pinDb(pinRow({ status: 'disabled' })) as never, 'proj-1', 'prc_conn-1', 'gpt-4o');
        expect(inactive.errors.some((e) => e.includes('not active'))).toBe(true);

        const proxy = await validatePinnedConnection(
            pinDb(pinRow({ base_url: 'https://proxy.example.com/v1' })) as never, 'proj-1', 'prc_conn-1', 'gpt-4o',
        );
        expect(proxy.errors.some((e) => e.includes('custom proxy'))).toBe(true);

        const mismatch = await validatePinnedConnection(pinDb(pinRow({ provider: 'anthropic' })) as never, 'proj-1', 'prc_conn-1', 'gpt-4o');
        expect(mismatch.errors.some((e) => e.includes("not model 'gpt-4o'"))).toBe(true);
    });

    it('applies pins by registering the connection key, failing closed otherwise', async () => {
        const r = router();
        const applied = await applyPinnedConnection(r as never, pinDb(pinRow()) as never, {
            projectId: 'proj-1', organizationId: 'org-1', provider: 'openai', connectionId: 'prc_conn-1',
        });
        expect(applied).toEqual({ connectionId: 'prc_conn-1' });
        expect(r.calls).toHaveLength(1);
        expect(registerByokKey(r as never, 'nope', 'sk-x')).toBe(false);

        await expect(applyPinnedConnection(router() as never, pinDb(null) as never, {
            projectId: 'proj-1', organizationId: 'org-1', provider: 'openai', connectionId: 'prc_nope',
        })).rejects.toThrow('not found');

        await expect(applyPinnedConnection(router() as never, pinDb(pinRow({ status: 'unhealthy' })) as never, {
            projectId: 'proj-1', organizationId: 'org-1', provider: 'openai', connectionId: 'prc_conn-1',
        })).rejects.toThrow('not active');
    });
});
