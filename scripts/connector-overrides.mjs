#!/usr/bin/env node
/**
 * connector-overrides — curation workbench for connector param_overrides.
 *
 * Lists the operations an imported OpenAPI spec will become (same naming
 * semantics as parseOpenApiOps: operationId or synthesized, deduped) so
 * param_overrides entries can be keyed to real op names, not guesses.
 *
 * Usage:
 *   node scripts/connector-overrides.mjs <spec_url_or_file> [--contains substring] [--limit N] [--skeleton]
 *
 * --skeleton emits a ready-to-paste connectors.param_overrides JSON with
 * empty entries per printed operation.
 */

const args = process.argv.slice(2);
const source = args[0];
if (!source || source.startsWith('--')) {
    console.error('Usage: node scripts/connector-overrides.mjs <spec_url_or_file> [--contains substring] [--limit N] [--skeleton]');
    process.exit(1);
}
const flag = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? (args[i + 1] ?? fallback) : undefined;
};
const contains = flag('contains', '');
const limit = Number(flag('limit', '0')) || Infinity;
const skeleton = args.includes('--skeleton');

const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);
const cleanSegment = (path) => path.split('/').filter(Boolean).map((s) => s.replace(/[^A-Za-z0-9_]/g, '').replace(/^{.*}$/, '')).filter(Boolean).join('_') || 'root';

let raw;
if (/^https:\/\//.test(source)) {
    const res = await fetch(source, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) {
        console.error(`Spec fetch failed: HTTP ${res.status}`);
        process.exit(1);
    }
    raw = await res.json();
} else {
    const { readFileSync } = await import('node:fs');
    raw = JSON.parse(readFileSync(source, 'utf8'));
}

if (typeof raw?.openapi !== 'string' || !raw.openapi.startsWith('3.')) {
    console.error('Only OpenAPI 3.x JSON specs carry through import (this spec is not readable OpenAPI 3.x).');
    process.exit(2);
}
const title = raw?.info?.title ?? '';
const baseUrl = (Array.isArray(raw.servers) ? raw.servers.find((s) => typeof s?.url === 'string' && s.url.startsWith('https://'))?.url : undefined) ?? null;

const operations = [];
const seen = new Set();
for (const [path, item] of Object.entries(raw.paths ?? {})) {
    if (!item || typeof item !== 'object') continue;
    const pathParamsAll = Array.isArray(item.parameters) ? item.parameters : [];
    for (const [method, op] of Object.entries(item)) {
        if (!HTTP_METHODS.has(method) || !op || typeof op !== 'object') continue;
        const isName = typeof op.operationId === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(op.operationId);
        const baseName = isName ? op.operationId : `${method}_${cleanSegment(path)}`.slice(0, 39);
        let name = baseName;
        let n = 1;
        while (seen.has(name)) {
            n += 1;
            const suffix = `_${n}`;
            name = baseName.slice(0, 39 - suffix.length) + suffix;
        }
        const params = [...pathParamsAll, ...(Array.isArray(op.parameters) ? op.parameters : [])];
        const query = params.filter((p) => p?.in === 'query').map((p) => `${p.name}${p.required ? '*' : ''}`);
        const pathParams = params.filter((p) => p?.in === 'path').map((p) => `${p.name}`);
        seen.add(name);
        operations.push({
            name,
            method: method.toUpperCase(),
            path,
            path_params: pathParams,
            query_params: query,
            has_body: Boolean(op.requestBody?.content?.['application/json']?.schema),
            summary: op.summary ?? op.description ?? '',
        });
    }
}

const filtered = contains
    ? operations.filter((op) => op.name.includes(contains) || op.path.includes(contains))
    : operations;
const out = filtered.slice(0, limit);

console.log(JSON.stringify({
    title,
    base_url: baseUrl,
    total_from_spec: operations.length,
    shown: out.length,
    ...(skeleton ? { param_overrides_skeleton: Object.fromEntries(out.map((op) => [op.name, {}])) } : {}),
    operations: out,
}, null, 2));
