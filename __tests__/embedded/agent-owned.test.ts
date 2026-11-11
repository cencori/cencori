import { describe, expect, it } from 'vitest';
import { ownedRow, type OwnedKind } from '@/lib/embedded/agent-owned';

type Row = Record<string, unknown>;

/** agents, agent_versions and tool_connections in memory: just the queries ownership makes. */
function fakeDb(tables: Record<string, Row[]>) {
    const read = (row: Row, key: string) => (key === 'metadata->>agent_id' ? (row.metadata as Row).agent_id ?? null : row[key]);
    return {
        from: (table: string) => {
            const rows = tables[table] ?? (tables[table] = []);
            const filters: Array<[string, unknown]> = [];
            let patch: Row | null = null;
            const match = () => rows.filter((row) => filters.every(([key, value]) => read(row, key) === value));
            const builder = {
                select: () => builder,
                eq: (key: string, value: unknown) => { filters.push([key, value]); return builder; },
                is: (key: string, value: unknown) => { filters.push([key, value]); return builder; },
                order: () => builder,
                limit: () => builder,
                maybeSingle: async () => ({ data: match()[0] ?? null, error: null }),
                update: (values: Row) => { patch = values; return builder; },
                insert: async (values: Row[]) => { rows.push(...values.map((value, i) => ({ id: `copy${rows.length + i}`, ...value }))); return { error: null }; },
                then: (resolve: (value: unknown) => void) => {
                    const found = match();
                    if (patch) for (const row of found) Object.assign(row, patch);
                    resolve({ data: found, error: null });
                },
            };
            return builder;
        },
    };
}

const KIND: OwnedKind = {
    slug: 'catalog',
    tool: 'sell_products',
    historyOf: (metadata, agentId) => ((metadata.orders ?? []) as Array<{ agent_id: string }>).filter((o) => o.agent_id === agentId).length,
    withoutHistory: (metadata) => ({ ...metadata, orders: [] }),
};

const row = (id: string, metadata: Row) => ({ id, project_id: 'p1', connector_slug: 'catalog', status: 'active', encrypted_access_ref: null, key_hint: null, metadata });
const agent = (id: string, stable: string | null = null) => ({ id, project_id: 'p1', stable_version_id: stable });
const version = (id: string, agentId: string, tools: Row) => ({ id, project_id: 'p1', agent_id: agentId, config_json: { system_tools: tools } });
const owner = (r: Row | null) => (r?.metadata as Row | undefined)?.agent_id;

describe('what an agent owns', () => {
    it('gives each agent only its own row', async () => {
        const db = fakeDb({
            agents: [agent('a1'), agent('a2'), agent('a3')],
            tool_connections: [row('c1', { agent_id: 'a1', products: ['dress'] }), row('c2', { agent_id: 'a2', products: ['bag'] })],
        });
        expect((await ownedRow(db as never, 'p1', 'a1', KIND))?.id).toBe('c1');
        expect((await ownedRow(db as never, 'p1', 'a2', KIND))?.id).toBe('c2');
        expect(await ownedRow(db as never, 'p1', 'a3', KIND)).toBeNull();
        // Without an agent it's the project's first one.
        expect((await ownedRow(db as never, 'p1', null, KIND))?.id).toBe('c1');
    });

    it('hands a row from before to the one agent using it, and to no other', async () => {
        const tables = {
            agents: [agent('a1'), agent('a2')],
            agent_versions: [version('v2', 'a2', { sell_products: {} }), version('v1', 'a1', { end_conversation: {} })],
            tool_connections: [row('c1', { products: ['dress'], orders: [] })],
        };
        const db = fakeDb(tables);
        // Asked for by the agent that never used it: it gets nothing, and the row goes to the one that did.
        expect(await ownedRow(db as never, 'p1', 'a1', KIND)).toBeNull();
        expect((await ownedRow(db as never, 'p1', 'a2', KIND))?.id).toBe('c1');
        expect(tables.tool_connections).toHaveLength(1);
    });

    it('copies it, without the history, when several agents were using it', async () => {
        const tables = {
            agents: [agent('a1', 'v1'), agent('a2')],
            // a1 sells in its live version (its newer draft has it off); a2 in its latest.
            agent_versions: [version('v1b', 'a1', {}), version('v2', 'a2', { sell_products: {} }), version('v1', 'a1', { sell_products: true })],
            tool_connections: [row('c1', { products: ['dress'], orders: [{ agent_id: 'a2' }, { agent_id: 'a2' }, { agent_id: 'a1' }] })],
        };
        const db = fakeDb(tables);
        const mine = await ownedRow(db as never, 'p1', 'a1', KIND);
        const theirs = await ownedRow(db as never, 'p1', 'a2', KIND);
        // The agent with most of the orders keeps the row and its history.
        expect(theirs?.id).toBe('c1');
        expect((theirs?.metadata as Row).orders).toHaveLength(3);
        expect(owner(mine)).toBe('a1');
        expect(mine?.id).not.toBe('c1');
        expect((mine?.metadata as Row).products).toEqual(['dress']);
        expect((mine?.metadata as Row).orders).toEqual([]);
        expect(tables.tool_connections).toHaveLength(2);
    });

    it('gives it to the first agent when none has the tool on', async () => {
        const db = fakeDb({ agents: [agent('a1'), agent('a2')], agent_versions: [], tool_connections: [row('c1', { products: [] })] });
        expect(await ownedRow(db as never, 'p1', 'a2', KIND)).toBeNull();
        expect((await ownedRow(db as never, 'p1', 'a1', KIND))?.id).toBe('c1');
    });
});
