import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/security/outbound-url', () => ({
    safeOutboundFetch: (...args: unknown[]) => (globalThis as Record<string, unknown>).__outboundFetch?.(...args),
    assertSafeOutboundUrl: vi.fn(() => true),
}));

import {
    CONNECTOR_OPS_MAX,
    ConnectorOpError,
    classifyConnectorOp,
    connectorHostedToolName,
    connectorManifestTools,
    connectorOpInput,
    fetchOpenApiSpec,
    findConnectorSnapshot,
    parseConnectorHostedToolName,
    parseOpenApiBaseUrl,
    parseOpenApiOps,
    type ConnectorOperation,
    type ConnectorSnapshot,
} from '@/lib/embedded/connector-ops';

const SPEC = {
    openapi: '3.1.0',
    info: { title: 'Acme CRM' },
    servers: [{ url: 'https://api.acme.example/v1' }],
    components: { schemas: { Order: { type: 'object', properties: { id: { type: 'string' } } } } },
    paths: {
        '/orders/{id}': {
            get: {
                operationId: 'get_order',
                summary: 'Get order',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                    { name: 'expand', in: 'query', schema: { type: 'string' } },
                ],
            },
            delete: {
                operationId: 'delete_order',
                requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } } },
            },
        },
        '/orders': {
            post: {
                operationId: 'create_order',
                description: 'Create',
                requestBody: { content: { 'application/json': { schema: { properties: { item: { type: 'string' } } } } } },
            },
        },
    },
};

describe('parseOpenApiOps', () => {
    it('extracts operations with path params, query, and resolved body refs', () => {
        const ops = parseOpenApiOps(SPEC);
        const get = ops.find((o) => o.name === 'get_order')!;
        expect(get.pathParams).toEqual(['id']);
        expect((get.parameters.properties as Record<string, unknown>).id).toEqual({ type: 'string', required: true, description: undefined });
        const body = ((get.parameters.properties as Record<string, unknown>).query as Record<string, unknown>).properties;
        expect(body).toEqual({ expand: { type: 'string', required: false } });

        const deleted = ops.find((o) => o.name === 'delete_order')!;
        expect((deleted.parameters.properties as Record<string, unknown>).body).toMatchObject({ properties: { id: { type: 'string' } } });

        const created = ops.find((o) => o.name === 'create_order')!;
        expect(created.description).toBe('Create');
    });

    it('synthesizes operationIds and honours the operations filter', () => {
        const spec = { ...SPEC, paths: { '/invoice-notes/list': { get: { summary: 'List' } } } };
        const ops = parseOpenApiOps(spec);
        expect(ops[0].name).toBe('get_invoice_notes_list');
        expect(parseOpenApiOps(SPEC, ['get_order']).map((o) => o.name)).toEqual(['get_order']);
    });

    it('rejects invalid specs and unknown filters', () => {
        expect(() => parseOpenApiOps({ openapi: '2.0' })).toThrow(ConnectorOpError);
        expect(() => parseOpenApiOps(SPEC, ['missing_op'])).toThrow(/not found in spec/);
        expect(() => parseOpenApiOps({ ...SPEC, servers: [] })).not.toThrow();
    });
});

describe('hosted tool names', () => {
    it('round-trips the conn namespace', () => {
        const id = 'con_9f8e7d6c5b4a3f2e';
        const name = connectorHostedToolName(id, 'get_order');
        expect(parseConnectorHostedToolName(name)).toEqual({ connShort: '9f8e7d6c', op: 'get_order' });
        expect(parseConnectorHostedToolName('mcp__abc__def')).toBeNull();
    });
});

describe('classifyConnectorOp', () => {
    it('reads auto-execute, writes and deletes require approval', () => {
        expect(classifyConnectorOp('GET')).toEqual({ risk: 'read', approval: 'auto' });
        expect(classifyConnectorOp('POST')).toEqual({ risk: 'write', approval: 'required' });
        expect(classifyConnectorOp('DELETE')).toEqual({ risk: 'destructive', approval: 'required' });
    });
});

describe('connectorManifestTools', () => {
    const snapshot: ConnectorSnapshot = {
        id: '9f8e7d6c5b4a3f2e',
        slug: 'generic-http',
        baseUrl: 'https://api.acme.example/v1',
        operations: [
            { name: 'get_order', method: 'GET', path: '/orders/{id}', pathParams: ['id'], parameters: { type: 'object', properties: {}, required: [] } },
            { name: 'create_order', method: 'POST', path: '/orders', pathParams: [], parameters: { type: 'object', properties: {}, required: [] } },
        ] as ConnectorOperation[],
    };
    const snapshots = new Map([[snapshot.id.toLowerCase(), snapshot]]);

    it('builds tools with approval flags; GET is auto, POST needs approval', () => {
        const tools = connectorManifestTools([{ connection_id: snapshot.id }], snapshots);
        expect(tools.map((t) => t.function.name)).toEqual(['conn__9f8e7d6c__get_order', 'conn__9f8e7d6c__create_order']);
        expect(tools[0].needsApproval).toBeUndefined();
        expect(tools[1].needsApproval).toBe(true);
    });

    it('filters operations and hides unimported grants', () => {
        const filtered = connectorManifestTools([{ connection_id: snapshot.id, operations: ['get_order'] }], snapshots);
        expect(filtered.map((t) => t.function.name)).toEqual(['conn__9f8e7d6c__get_order']);
        expect(connectorManifestTools([{ connection_id: snapshot.id }], null)).toEqual([]);
    });
});

describe('connectorOpInput', () => {
    it('templates path params and pulls reserved keys', () => {
        const input = connectorOpInput({ method: 'GET', path: '/orders/{id}' }, { id: 'o 42', query: { expand: 'items', skip: null } });
        expect(input).toEqual({ method: 'GET', path: '/orders/o%2042', query: { expand: 'items' } });
    });

    it('throws on missing path params and includes body for non-GET', () => {
        expect(() => connectorOpInput({ method: 'GET', path: '/orders/{id}' }, {})).toThrow(/Missing path parameter/);
        expect(connectorOpInput({ method: 'POST', path: '/orders' }, { body: { item: 'x' } }).body).toEqual({ item: 'x' });
        expect(connectorOpInput({ method: 'GET', path: '/orders' }, {}).body).toBeUndefined();
    });
});

describe('spec url/base helpers', () => {
    beforeEach(() => {
        delete process.env.HTTPS_PROXY;
    });

    it('rejects non-https spec urls and reads the first https server', async () => {
        await expect(fetchOpenApiSpec('http://api.acme.example/openapi.json')).rejects.toThrow(ConnectorOpError);
        expect(parseOpenApiBaseUrl(SPEC)).toBe('https://api.acme.example/v1');
        expect(parseOpenApiBaseUrl({ servers: [{ url: 'http://insecure' }] })).toBeUndefined();
        const snap: ConnectorSnapshot = { id: 'abc', slug: 'generic-http', baseUrl: null, operations: [] };
        expect(findConnectorSnapshot(new Map([[snap.id.toLowerCase(), snap]]), 'ab')?.id).toBe('abc');
        expect(CONNECTOR_OPS_MAX).toBe(60);
    });
});
