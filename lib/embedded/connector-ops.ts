import { dePrefixId } from './http';
import { safeOutboundFetch } from '@/lib/security/outbound-url';

/**
 * Imported OpenAPI connector operations: phase-2 of the connector catalog —
 * a customer's own REST API becomes model tools from their OpenAPI spec,
 * executed through the connection's stored credential (BYOK/OAuth2) with
 * egress policy and the normal approval ladder. Hosted tool namespace is
 * `conn__<connectionIdShort>__<operationId>`, mirroring `mcp__` grants.
 */

export interface ConnectorOperation {
    name: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    description?: string;
    pathParams: string[];
    parameters: Record<string, unknown>;
}

export interface ConnectorSnapshot {
    id: string;
    slug: string;
    baseUrl: string | null;
    operations: ConnectorOperation[];
}

export const CONNECTOR_OPS_MAX = 60;
export const CONNECTOR_SCHEMA_MAX_BYTES = 1500;
export const CONNECTOR_SPEC_MAX_BYTES = 256 * 1024;

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

export class ConnectorOpError extends Error {
    constructor(message: string, readonly status = 400) {
        super(message);
        this.name = 'ConnectorOpError';
    }
}

/** Fetch a raw OpenAPI JSON document (https only, sized). */
export async function fetchOpenApiSpec(specUrl: string): Promise<unknown> {
    if (!specUrl.startsWith('https://')) throw new ConnectorOpError('spec_url must be https');
    const res = await safeOutboundFetch(specUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
    }, { maxRedirects: 0 });
    if (!res.ok) throw new ConnectorOpError(`Spec unavailable (${res.status})`, 502);
    const text = await res.text();
    if (text.length > CONNECTOR_SPEC_MAX_BYTES) throw new ConnectorOpError(`Spec exceeds ${CONNECTOR_SPEC_MAX_BYTES} bytes`);
    try {
        return JSON.parse(text);
    } catch {
        throw new ConnectorOpError('spec_url did not return JSON (OpenAPI 3.x)');
    }
}

/** Shallow JSON-Pointer $ref resolution inside components (depth-capped). */
function resolveSchema(node: unknown, components: Record<string, unknown> | null, depth = 0): unknown {
    if (depth > 6 || node === null || typeof node !== 'object') return node;
    const { $ref, ...rest } = node as Record<string, unknown>;
    if (typeof $ref === 'string' && $ref.startsWith('#/components/schemas/') && components) {
        const target = components[$ref.slice('#/components/schemas/'.length)];
        if (target) return resolveSchema(target, components, depth + 1);
        return { type: 'object' };
    }
    const out: Record<string, unknown> = { ...rest };
    for (const key of ['properties', 'items', 'additionalProperties'] as const) {
        const child = out[key];
        if (Array.isArray(child) && key === 'items') out[key] = resolveSchema(child, components, depth + 1);
        else if (child && typeof child === 'object' && !Array.isArray(child) && key === 'properties') {
            const mapped: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(child as Record<string, unknown>)) mapped[k] = resolveSchema(v, components, depth + 1);
            out[key] = mapped;
        } else if (child && typeof child === 'object' && key === 'additionalProperties') out[key] = resolveSchema(child, components, depth + 1);
    }
    if (Object.keys(rest).length === 0 && $ref) return { type: 'object' };
    return out;
}

function cleanSegment(path: string): string {
    return path.replace(/\{[^}]+\}/g, '').replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'root';
}

function sizeCap(node: unknown): unknown {
    const json = JSON.stringify(node ?? null);
    if (json.length > CONNECTOR_SCHEMA_MAX_BYTES) return { type: 'object', description: ' requestBody (schema omitted: too large)' };
    return node;
}

/**
 * OpenAPI 3.x JSON → normalized connector operations. A `filter` limits the
 * imported operationIds. Throws ConnectorOpError on invalid specs, oversized
 * catalogs, or duplicate/unresolvable operationIds.
 */
export function parseOpenApiOps(raw: unknown, filter?: string[]): ConnectorOperation[] {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ConnectorOpError('spec must be an object');
    const spec = raw as Record<string, unknown>;
    if (typeof spec.openapi !== 'string' || !/^3\./.test(spec.openapi)) throw new ConnectorOpError('Only OpenAPI 3.x (JSON) specs are supported');
    if (!spec.paths || typeof spec.paths !== 'object' || Array.isArray(spec.paths)) throw new ConnectorOpError('spec.paths is required');
    const components = (spec.components as { schemas?: Record<string, unknown> } | undefined)?.schemas ?? null;

    const filterSet = filter?.length ? new Set(filter) : null;
    const seen = new Set<string>();
    const operations: ConnectorOperation[] = [];

    for (const [path, item] of Object.entries(spec.paths as Record<string, unknown>)) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        const pathParamsAll = ((item as Record<string, unknown>).parameters as unknown[] | undefined) ?? [];
        for (const [method, opNode] of Object.entries(item as Record<string, unknown>)) {
            if (!HTTP_METHODS.has(method)) continue;
            const op = opNode as Record<string, unknown>;
            const rawParams = (op.parameters as unknown[] | undefined) ?? [];
            const allParams = [...pathParamsAll, ...rawParams];
            const isName = typeof op.operationId === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(op.operationId);
            // Synthesized names collide after truncation (e.g. HubSpot's
            // batch/update vs batch/upsert → `..._batch_u`): suffix `_2`, `_3`,
            // … instead of silently dropping the duplicate operation.
            const baseName = isName ? (op.operationId as string) : `${method}_${cleanSegment(path)}`.slice(0, 39);
            let name = baseName;
            let n = 1;
            while (seen.has(name)) {
                n += 1;
                const suffix = `_${n}`;
                name = baseName.slice(0, 39 - suffix.length) + suffix;
            }
            if (filterSet && !filterSet.has(name)) continue;

            const pathParams: string[] = [];
            const pathProps: Record<string, unknown> = {};
            const queryProps: Record<string, unknown> = {};
            for (const param of (Array.isArray(allParams) ? allParams : []) as Array<Record<string, unknown>>) {
                if (!param || typeof param.name !== 'string') continue;
                const schema = { type: typeof param.schema === 'object' && param.schema !== null ? (param.schema as Record<string, unknown>).type ?? 'string' : 'string' };
                if (param.in === 'path') {
                    pathParams.push(param.name);
                    pathProps[param.name] = { ...schema, required: true, description: typeof param.description === 'string' ? param.description : undefined };
                } else if (param.in === 'query') {
                    queryProps[param.name] = { ...schema, required: param.required === true };
                }
            }
            const properties: Record<string, unknown> = { ...pathProps };
            if (Object.keys(queryProps).length > 0) properties.query = { type: 'object', properties: queryProps, additionalProperties: false };
            let body: unknown = null;
            if (method !== 'GET' && op.requestBody && typeof op.requestBody === 'object') {
                const content = ((op.requestBody as Record<string, unknown>).content ?? {}) as Record<string, unknown>;
                const jsonBody = (content['application/json'] ?? {}) as { schema?: unknown };
                if (typeof jsonBody.schema === 'object' && jsonBody.schema !== null) {
                    body = sizeCap(resolveSchema(jsonBody.schema, components));
                    properties.body = body as Record<string, unknown>;
                }
            }
            const rawDescription = [op.summary, op.description, typeof op.operationId === 'string' ? null : `${method.toUpperCase()} ${path}`]
                .filter((part): part is string => typeof part === 'string' && part.length > 0);
            operations.push({
                name,
                method: method.toUpperCase() as ConnectorOperation['method'],
                path,
                description: rawDescription.join(' — ').slice(0, 500) || `${method.toUpperCase()} ${path}`,
                pathParams,
                parameters: {
                    type: 'object',
                    properties,
                    required: pathParams,
                    additionalProperties: true,
                },
            });
            seen.add(name);
            if (operations.length >= CONNECTOR_OPS_MAX) break;
        }
    }
    if (operations.length > CONNECTOR_OPS_MAX) throw new ConnectorOpError(`Spec yields more than ${CONNECTOR_OPS_MAX} operations; cap is ${CONNECTOR_OPS_MAX}`);
    if (filterSet && filterSet.size !== operations.length) {
        throw new ConnectorOpError(`Operations not found in spec: ${[...filterSet].filter((n) => !seen.has(n)).join(', ')}`);
    }
    return operations;
}

/** https base URL from the spec (first server), else undefined. */
export function parseOpenApiBaseUrl(raw: unknown): string | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const servers = ((raw as Record<string, unknown>).servers ?? []) as Array<{ url?: unknown }>;
    for (const server of Array.isArray(servers) ? servers : []) {
        if (server && typeof server.url === 'string' && server.url.startsWith('https://')) {
            return server.url;
        }
    }
    return undefined;
}

function cleanPart(s: string): string {
    return s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'op';
}

export function connectorHostedToolName(connectionId: string, operation: string): string {
    const short = dePrefixId(connectionId).replace(/-/g, '').slice(0, 8);
    return `conn__${cleanPart(short)}__${cleanPart(operation)}`.slice(0, 64);
}

export function parseConnectorHostedToolName(name: string): { connShort: string; op: string } | null {
    const m = /^conn__([A-Za-z0-9_-]{1,8})__([A-Za-z0-9_-]{1,40})$/.exec(name);
    if (!m) return null;
    return { connShort: m[1], op: m[2] };
}

/** Risk by HTTP method: GET reads auto-execute; DELETE is destructive; the rest need approval. */
export function classifyConnectorOp(method: string): { risk: 'read' | 'write' | 'destructive'; approval: 'auto' | 'required' } {
    if (/^(GET|HEAD)$/.test(method)) return { risk: 'read', approval: 'auto' };
    if (/^DELETE$/.test(method)) return { risk: 'destructive', approval: 'required' };
    return { risk: 'write', approval: 'required' };
}

/**
 * Curated per-operation enrichment, stored on `connectors.param_overrides` and
 * applied when a spec is imported. Additive metadata only (descriptions, enums,
 * required hints, dropped params) — never executable, so drift can only degrade
 * model guidance, not runtime behavior. Keys match exact operation names first,
 * then glob keys (`*_search`) so date-versioned vendor specs (HubSpot bumps the
 * version in every synthesized name) keep matching across releases.
 */
export type ParamOverrides = Record<string, {
    description?: string;
    /** Top-level property names, or `parent.child` dot paths (e.g. `body.filterGroups`, `query.limit`). */
    params?: Record<string, { description?: string; enum?: string[]; drop?: boolean }>;
    required?: string[];
}>;

function overrideFor(operationName: string, overrides: ParamOverrides): ParamOverrides[string] | undefined {
    const exact = overrides[operationName];
    if (exact) return exact;
    for (const [key, value] of Object.entries(overrides)) {
        if (!key.includes('*')) continue;
        const re = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, (c) => (c === '*' ? '[A-Za-z0-9_]*' : `\\${c}`))}$`);
        if (re.test(operationName)) return value;
    }
    return undefined;
}

/** Merge a param patch onto a copy of `current` (never the source object). */
function mergeParamPatch(current: Record<string, unknown>, patch: { description?: string; enum?: string[]; drop?: boolean }): Record<string, unknown> {
    const next: Record<string, unknown> = { ...current };
    if (patch.description !== undefined) next.description = patch.description;
    if (patch.enum !== undefined) next.enum = patch.enum;
    return next;
}

export function applyParamOverrides(operations: ConnectorOperation[], overrides: ParamOverrides): ConnectorOperation[] {
    if (!overrides || typeof overrides !== 'object') return operations;
    return operations.map((operation) => {
        const o = overrideFor(operation.name, overrides);
        if (!o) return operation;
        const properties = { ...((operation.parameters.properties as Record<string, unknown>) ?? {}) };
        for (const [name, patch] of Object.entries(o.params ?? {})) {
            const dotted = name.includes('.');
            const [topKey, childKey] = dotted ? name.split('.', 2) : [name, name];
            if (patch.drop) {
                if (dotted) {
                    const topProp = { ...((properties[topKey] ?? {}) as Record<string, unknown>) };
                    const nestedProps = { ...((topProp.properties ?? {}) as Record<string, unknown>) };
                    if (!(childKey in nestedProps)) continue;
                    delete nestedProps[childKey];
                    topProp.properties = nestedProps;
                    properties[topKey] = topProp;
                } else {
                    delete properties[name];
                }
                continue;
            }
            if (dotted) {
                const topProp = { ...((properties[topKey] ?? {}) as Record<string, unknown>) };
                const nestedProps = { ...((topProp.properties ?? {}) as Record<string, unknown>) };
                if (!(childKey in nestedProps)) continue;
                nestedProps[childKey] = mergeParamPatch((nestedProps[childKey] ?? {}) as Record<string, unknown>, patch);
                topProp.properties = nestedProps;
                properties[topKey] = topProp;
            } else {
                properties[name] = mergeParamPatch((properties[name] ?? {}) as Record<string, unknown>, patch);
            }
        }
        const required = [...new Set([...((operation.parameters.required as string[]) ?? []), ...(o.required ?? []).filter((name) => name in properties)])];
        for (const req of o.required ?? []) {
            const prop = properties[req] as Record<string, unknown> | undefined;
            if (prop) prop.required = true;
        }
        return {
            ...operation,
            ...(o.description !== undefined ? { description: o.description.slice(0, 500) } : {}),
            parameters: { type: 'object' as const, properties, required, additionalProperties: true },
        };
    });
}

/** Build hosted function tools from imported-operation snapshots (invisible when missing). */
export function connectorManifestTools(
    refs: Array<{ connection_id: string; operations?: string[] }>,
    snapshots: Map<string, ConnectorSnapshot> | null | undefined,
): Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> }; needsApproval?: boolean }> {
    const tools: Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> }; needsApproval?: boolean }> = [];
    if (!snapshots) return tools;
    const seen = new Set<string>();
    for (const ref of refs ?? []) {
        const snapshot = snapshots.get(dePrefixId(ref.connection_id).toLowerCase());
        if (!snapshot) continue;
        const wanted = ref.operations?.length ? new Set(ref.operations) : null;
        for (const operation of snapshot.operations) {
            if (wanted && !wanted.has(operation.name)) continue;
            const name = connectorHostedToolName(snapshot.id, operation.name);
            if (seen.has(name)) continue;
            const approval = classifyConnectorOp(operation.method).approval;
            tools.push({
                type: 'function',
                function: {
                    name,
                    description: (operation.description || `Connector ${operation.name}`).slice(0, 500),
                    parameters: operation.parameters && typeof operation.parameters === 'object' ? operation.parameters : { type: 'object', properties: {} },
                },
                ...(approval !== 'auto' ? { needsApproval: true } : {}),
            });
            seen.add(name);
        }
    }
    return tools;
}

/** Pick a snapshot by hosted-name connection discriminator (id-md5-normalized prefix). */
export function findConnectorSnapshot(snapshots: Map<string, ConnectorSnapshot>, connShort: string): ConnectorSnapshot | undefined {
    const target = connShort.toLowerCase();
    return [...snapshots.values()].find((s) => s.id.replace(/-/g, '').toLowerCase().startsWith(target));
}

/**
 * Args → executor input. Path variables come from top-level args; `query`,
 * `headers`, and `body` are the reserved nested keys. Missing required path
 * variables throw (never silently substitute).
 */
export function connectorOpInput(
    op: { method: string; path: string },
    args: Record<string, unknown>,
): { method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string; query: Record<string, string>; headers?: Record<string, string>; body?: unknown } {
    const path = op.path.replace(/\{([a-zA-Z0-9_-]+)\}/g, (_full, key: string) => {
        const value = args[key];
        if (value === undefined || value === null || String(value) === '') {
            throw new Error(`Missing path parameter '${key}' for ${op.method} ${op.path}`);
        }
        return encodeURIComponent(String(value));
    });
    const query: Record<string, string> = {};
    if (args.query && typeof args.query === 'object' && !Array.isArray(args.query)) {
        for (const [key, value] of Object.entries(args.query as Record<string, unknown>)) {
            if (value !== undefined && value !== null) query[key] = String(value);
        }
    }
    const headers = args.headers && typeof args.headers === 'object' && !Array.isArray(args.headers)
        ? Object.fromEntries(Object.entries(args.headers as Record<string, unknown>).map(([key, value]) => [key, String(value)]))
        : undefined;
    return {
        method: (/^(GET|POST|PUT|PATCH|DELETE)$/.test(op.method) ? op.method : 'GET') as 'GET',
        path,
        query,
        ...(headers ? { headers } : {}),
        ...(op.method !== 'GET' ? { body: args.body ?? {} } : {}),
    };
}

/**
 * Load imported-operation snapshots for manifest connection grants. Keyed by
 * lowercase de-prefixed connection id. Only active connections with imported
 * operations are returned.
 */
export async function loadConnectorSnapshots(
    supabase: { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: string) => { in: (col: string, vals: string[]) => Promise<{ data: unknown; error: unknown }> } } } },
    projectId: string,
    connectionIds: string[],
): Promise<Map<string, ConnectorSnapshot>> {
    const out = new Map<string, ConnectorSnapshot>();
    const ids = [...new Set(connectionIds.map((id) => dePrefixId(id)))].filter(Boolean);
    if (ids.length === 0) return out;
    try {
        const { data, error } = await (supabase.from('tool_connections') as ReturnType<typeof supabase.from>)
            .select('id, connector_slug, status, metadata, expires_at')
            .eq('project_id', projectId)
            .in('id', ids);
        if (error || !data) return out;
        for (const row of data as Array<Record<string, unknown>>) {
            if ((row.status as string) !== 'active') continue;
            const metadata = (row.metadata ?? {}) as Record<string, unknown>;
            const operations = metadata.operations;
            if (!Array.isArray(operations) || operations.length === 0) continue;
            out.set((row.id as string).toLowerCase(), {
                id: row.id as string,
                slug: (row.connector_slug as string) ?? 'generic-http',
                baseUrl: typeof metadata.base_url === 'string' ? metadata.base_url : null,
                operations: operations as ConnectorOperation[],
            });
        }
    } catch {
        // Best-effort: turns still run with manifest-declared tools only.
    }
    return out;
}
