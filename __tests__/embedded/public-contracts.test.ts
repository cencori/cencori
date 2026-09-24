import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const normalizePath = (path: string) => path.replace(/\{[^}]+\}|\[[^\]]+\]/g, '{}');

function routeFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? routeFiles(path) : entry.name === 'route.ts' ? [path] : [];
    });
}

describe('Embedded Agents public contracts', () => {
    const openapi = JSON.parse(read('openapi/embedded-agents.json')) as {
        servers: Array<{ url: string }>;
        components: {
            parameters: Record<string, unknown>;
            responses: Record<string, unknown>;
            schemas: Record<string, unknown>;
        };
        paths: Record<string, Record<string, Record<string, unknown> | unknown>>;
    };

    const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;

    function documentedOperations() {
        return Object.entries(openapi.paths).flatMap(([path, item]) =>
            methods.flatMap((method) => {
                const operation = item[method];
                return operation && typeof operation === 'object'
                    ? [{ path, method, operation: operation as Record<string, unknown> }]
                    : [];
            }),
        );
    }

    it('maps every documented OpenAPI operation to an implemented handler', () => {
        const apiRoot = resolve(root, 'app/api');
        const handlers = routeFiles(resolve(apiRoot, 'v1')).flatMap((file) => {
            const source = readFileSync(file, 'utf8');
            const route = `/${file
                .slice(apiRoot.length)
                .replace(/^\//, '')
                .replace(/\/route\.ts$/, '')
                .replace(/\[([^\]]+)\]/g, '{$1}')}`;

            return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
                .filter((method) => new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`).test(source))
                .map((method) => `${method} ${normalizePath(route)}`);
        });

        const documented = documentedOperations().map(
            ({ path, method }) => `${method.toUpperCase()} ${normalizePath(path)}`,
        );

        expect(documented).toHaveLength(122);
        expect(documented.filter((operation) => !handlers.includes(operation))).toEqual([]);
    });

    it('documents every implemented operation in each Embedded Agents API family', () => {
        const apiRoot = resolve(root, 'app/api');
        const documented = new Set(
            documentedOperations().map(
                ({ path, method }) => `${method.toUpperCase()} ${normalizePath(path)}`,
            ),
        );
        const families = new Set(
            Object.keys(openapi.paths).map((path) => path.split('/')[2]),
        );
        const handlers = routeFiles(resolve(apiRoot, 'v1')).flatMap((file) => {
            const route = `/${file
                .slice(apiRoot.length)
                .replace(/^\//, '')
                .replace(/\/route\.ts$/, '')
                .replace(/\[([^\]]+)\]/g, '{$1}')}`;
            if (!families.has(route.split('/')[2])) return [];

            const source = readFileSync(file, 'utf8');
            return methods
                .filter((method) => new RegExp(`export\\s+(?:async\\s+)?function\\s+${method.toUpperCase()}\\b`).test(source))
                .map((method) => `${method.toUpperCase()} ${normalizePath(route)}`);
        });

        expect(handlers.filter((operation) => !documented.has(operation))).toEqual([]);
    });

    it('publishes a typed and intentionally complete operation contract', () => {
        const operations = documentedOperations();
        const operationIds = operations.map(({ operation }) => operation.operationId);

        expect(Object.keys(openapi.components.schemas).length).toBeGreaterThanOrEqual(100);
        expect(new Set(operationIds).size).toBe(operations.length);

        for (const { path, method, operation } of operations) {
            expect(operation.operationId, `${method.toUpperCase()} ${path} needs operationId`).toEqual(expect.any(String));
            expect(operation.tags, `${method.toUpperCase()} ${path} needs a tag`).toEqual(expect.any(Array));

            if (['post', 'put', 'patch'].includes(method)) {
                expect(
                    Boolean(operation.requestBody) || operation['x-cencori-empty-body'] === true,
                    `${method.toUpperCase()} ${path} needs request body semantics`,
                ).toBe(true);
            }

            const responses = operation.responses as Record<string, Record<string, unknown>>;
            expect(responses?.default, `${method.toUpperCase()} ${path} needs the standard error response`).toEqual({
                $ref: '#/components/responses/Error',
            });

            const success = Object.entries(responses).find(([status]) => /^[23]\d\d$/.test(status));
            expect(success, `${method.toUpperCase()} ${path} needs a success response`).toBeTruthy();
            if (success && !['204', '302'].includes(success[0])) {
                expect(success[1].content, `${method.toUpperCase()} ${path} needs typed success content`).toBeTruthy();
            }
        }
    });

    it('declares every path variable and resolves every component reference', () => {
        for (const [path, item] of Object.entries(openapi.paths)) {
            const expected = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
            const parameters = (item.parameters ?? []) as Array<{ $ref?: string }>;
            const declared = parameters.map((parameter) => {
                const name = parameter.$ref?.split('/').at(-1);
                const component = name ? openapi.components.parameters[name] as { name?: string } : undefined;
                return component?.name;
            });
            expect(declared, `${path} path parameters`).toEqual(expected);
        }

        const serialized = JSON.stringify(openapi);
        for (const match of serialized.matchAll(/"\$ref":"#\/components\/(schemas|parameters|responses)\/([^"/]+)"/g)) {
            const [, group, name] = match;
            expect(
                openapi.components[group as keyof typeof openapi.components][name],
                `unresolved component reference ${group}/${name}`,
            ).toBeTruthy();
        }
    });

    it('publishes one canonical origin and a real JSON specification route', () => {
        expect(openapi.servers).toEqual([{ url: 'https://cencori.com' }]);
        expect(existsSync(resolve(root, 'app/openapi/embedded-agents.json/route.ts'))).toBe(true);

        const llm = read('public/llm.txt');
        expect(llm).toContain('https://cencori.com/openapi/embedded-agents.json');
        expect(llm).toContain('https://cencori.com/docs/embedded-agents/overview');
        expect(llm).not.toContain('Docs: https://cencori.com/docs/embedded-agents (');
    });

    it('keeps Embedded Agents discoverable in both documentation navigation systems', () => {
        const rootMeta = JSON.parse(read('content/docs/meta.json')) as { pages: string[] };
        const embeddedMeta = JSON.parse(read('content/docs/embedded-agents/meta.json')) as { pages: string[] };
        const docsSource = read('lib/docs.ts');

        expect(rootMeta.pages).toContain('embedded-agents');
        expect(embeddedMeta.pages).toContain('overview');
        expect(docsSource).toContain("'Embedded Agents'");
        expect(existsSync(resolve(root, 'app/docs/embedded-agents/page.tsx'))).toBe(true);
    });

    it('keeps package versions and public version claims aligned', () => {
        const sdk = JSON.parse(read('packages/sdk/package.json')) as { version: string };
        const mcp = JSON.parse(read('packages/mcp/package.json')) as { version: string };
        const pythonVersion = read('packages/python-sdk/pyproject.toml').match(/^version = "([^"]+)"/m)?.[1];
        const llm = read('public/llm.txt');

        expect(sdk.version).toBe('1.7.1');
        expect(mcp.version).toBe('0.8.0');
        expect(pythonVersion).toBe('1.5.0');
        expect(llm).toContain('`cencori@1.7.1`');
        expect(llm).toContain('`@cencori/mcp@0.8.0`');
        expect(llm).toContain('Embedded Agents Python SDK: not yet published');
        expect(llm).not.toContain('`cencori>=1.5.0`');
    });

    it('uses the same delegation and delivery semantics across documentation and SDKs', () => {
        const manifests = read('content/docs/embedded-agents/manifests-browser-subagents.mdx');
        const runs = read('content/docs/embedded-agents/runs-delegation.mdx');
        const python = read('packages/python-sdk/src/cencori/embedded.py');

        expect(manifests).toContain('no inherited installation or session');
        expect(runs).toContain('no inherited installation or session');
        expect(runs).toContain('durable JSON event log');
        expect(python).toContain('single-claim, at-most-once dispatch');
        expect(python.toLowerCase()).not.toContain('exactly-once');
    });
});
