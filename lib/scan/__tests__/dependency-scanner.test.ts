import { describe, expect, test, vi, afterAll, beforeAll } from 'vitest';
import {
    parsePackageLock,
    parseYarnLock,
    parsePnpmLock,
    parseRequirementsTxt,
    parseGoSum,
    parseLockfile,
    isLockfile,
    scanDependencies,
} from '../dependency-scanner';

// ── Lockfile Detection ───────────────────────────────────────────────

describe('isLockfile', () => {
    test('detects package-lock.json', () => {
        expect(isLockfile('package-lock.json')).toBe(true);
    });

    test('detects nested lockfile paths', () => {
        expect(isLockfile('projects/web/package-lock.json')).toBe(true);
    });

    test('detects yarn.lock', () => {
        expect(isLockfile('yarn.lock')).toBe(true);
    });

    test('detects pnpm-lock.yaml', () => {
        expect(isLockfile('pnpm-lock.yaml')).toBe(true);
    });

    test('detects requirements.txt', () => {
        expect(isLockfile('requirements.txt')).toBe(true);
    });

    test('detects go.sum', () => {
        expect(isLockfile('go.sum')).toBe(true);
    });

    test('rejects non-lockfiles', () => {
        expect(isLockfile('package.json')).toBe(false);
        expect(isLockfile('index.ts')).toBe(false);
        expect(isLockfile('go.mod')).toBe(false);
    });
});

// ── Package Lock Parser ──────────────────────────────────────────────

describe('parsePackageLock', () => {
    test('parses lockfileVersion 2 (packages key)', () => {
        const lockfile = JSON.stringify({
            lockfileVersion: 2,
            packages: {
                '': { name: 'my-app', version: '1.0.0' },
                'node_modules/lodash': { version: '4.17.21' },
                'node_modules/@types/node': { version: '20.10.0' },
            },
        });
        const deps = parsePackageLock(lockfile);
        expect(deps.length).toBe(2);
        expect(deps.some(d => d.name === 'lodash' && d.version === '4.17.21')).toBe(true);
        expect(deps.some(d => d.name === '@types/node' && d.version === '20.10.0')).toBe(true);
        expect(deps.every(d => d.ecosystem === 'npm')).toBe(true);
    });

    test('parses lockfileVersion 1 (dependencies key)', () => {
        const lockfile = JSON.stringify({
            lockfileVersion: 1,
            dependencies: {
                'express': { version: '4.18.2' },
                'body-parser': { version: '1.20.2' },
            },
        });
        const deps = parsePackageLock(lockfile);
        expect(deps.length).toBe(2);
        expect(deps.some(d => d.name === 'express' && d.version === '4.18.2')).toBe(true);
    });

    test('skips root package entry', () => {
        const lockfile = JSON.stringify({
            lockfileVersion: 3,
            packages: {
                '': { name: 'root', version: '1.0.0' },
            },
        });
        const deps = parsePackageLock(lockfile);
        expect(deps.length).toBe(0);
    });

    test('handles malformed JSON gracefully', () => {
        const deps = parsePackageLock('not valid json');
        expect(deps.length).toBe(0);
    });
});

// ── Yarn Lock Parser ─────────────────────────────────────────────────

describe('parseYarnLock', () => {
    test('parses yarn.lock v1 format', () => {
        const content = `
"lodash@^4.17.21":
  version "4.17.21"
  resolved "https://registry.yarnpkg.com/lodash/-/lodash-4.17.21.tgz"

"express@^4.18.0":
  version "4.18.2"
  resolved "https://registry.yarnpkg.com/express/-/express-4.18.2.tgz"
`;
        const deps = parseYarnLock(content);
        expect(deps.length).toBe(2);
        expect(deps.some(d => d.name === 'lodash' && d.version === '4.17.21')).toBe(true);
        expect(deps.some(d => d.name === 'express' && d.version === '4.18.2')).toBe(true);
    });

    test('handles scoped packages', () => {
        const content = `
"@babel/core@^7.23.0":
  version "7.23.5"
  resolved "https://registry.yarnpkg.com/@babel/core/-/core-7.23.5.tgz"
`;
        const deps = parseYarnLock(content);
        expect(deps.length).toBe(1);
        expect(deps[0].name).toBe('@babel/core');
        expect(deps[0].version).toBe('7.23.5');
    });

    test('deduplicates entries', () => {
        const content = `
"lodash@^4.17.15":
  version "4.17.21"

"lodash@^4.17.21":
  version "4.17.21"
`;
        const deps = parseYarnLock(content);
        expect(deps.length).toBe(1);
    });
});

// ── pnpm Lock Parser ─────────────────────────────────────────────────

describe('parsePnpmLock', () => {
    test('parses pnpm-lock.yaml entries', () => {
        const content = `
lockfileVersion: '6.0'
packages:
  /lodash@4.17.21:
    resolution: {integrity: sha512-xxx}
  /@types/node@20.10.0:
    resolution: {integrity: sha512-yyy}
`;
        const deps = parsePnpmLock(content);
        expect(deps.length).toBe(2);
        expect(deps.some(d => d.name === 'lodash' && d.version === '4.17.21')).toBe(true);
        expect(deps.some(d => d.name === '@types/node' && d.version === '20.10.0')).toBe(true);
    });

    test('handles pnpm v9+ format (no leading slash)', () => {
        const content = `
lockfileVersion: '9.0'
packages:
  lodash@4.17.21:
    resolution: {integrity: sha512-xxx}
`;
        const deps = parsePnpmLock(content);
        expect(deps.length).toBe(1);
        expect(deps[0].name).toBe('lodash');
    });
});

// ── Requirements.txt Parser ──────────────────────────────────────────

describe('parseRequirementsTxt', () => {
    test('parses pinned versions', () => {
        const content = `
flask==2.3.2
requests==2.31.0
# this is a comment
numpy>=1.24.0
django==4.2.7
`;
        const deps = parseRequirementsTxt(content);
        expect(deps.length).toBe(3); // only pinned (==)
        expect(deps.some(d => d.name === 'flask' && d.version === '2.3.2')).toBe(true);
        expect(deps.some(d => d.name === 'django' && d.version === '4.2.7')).toBe(true);
        expect(deps.every(d => d.ecosystem === 'PyPI')).toBe(true);
    });

    test('skips comments and flags', () => {
        const content = `
# Comment line
-r base.txt
--index-url https://pypi.org/simple
flask==2.3.2
`;
        const deps = parseRequirementsTxt(content);
        expect(deps.length).toBe(1);
    });

    test('lowercases package names', () => {
        const content = 'Flask==2.3.2\n';
        const deps = parseRequirementsTxt(content);
        expect(deps[0].name).toBe('flask');
    });
});

// ── Go Sum Parser ────────────────────────────────────────────────────

describe('parseGoSum', () => {
    test('parses go.sum entries', () => {
        const content = `
github.com/pkg/errors v0.9.1 h1:abc=
github.com/pkg/errors v0.9.1/go.mod h1:def=
github.com/gin-gonic/gin v1.9.1 h1:xyz=
github.com/gin-gonic/gin v1.9.1/go.mod h1:uvw=
`;
        const deps = parseGoSum(content);
        expect(deps.length).toBe(2); // deduped
        expect(deps.some(d => d.name === 'github.com/pkg/errors' && d.version === '0.9.1')).toBe(true);
        expect(deps.some(d => d.name === 'github.com/gin-gonic/gin' && d.version === '1.9.1')).toBe(true);
        expect(deps.every(d => d.ecosystem === 'Go')).toBe(true);
    });

    test('strips v prefix from versions', () => {
        const content = 'github.com/pkg/errors v0.9.1 h1:abc=\n';
        const deps = parseGoSum(content);
        expect(deps[0].version).toBe('0.9.1');
    });
});

// ── Unified Parser ───────────────────────────────────────────────────

describe('parseLockfile', () => {
    test('routes to correct parser by filename', () => {
        const lockfile = JSON.stringify({
            lockfileVersion: 2,
            packages: {
                '': { name: 'app', version: '1.0.0' },
                'node_modules/test-pkg': { version: '1.0.0' },
            },
        });
        const deps = parseLockfile('package-lock.json', lockfile);
        expect(deps.length).toBe(1);
        expect(deps[0].ecosystem).toBe('npm');
    });

    test('returns empty for unsupported files', () => {
        const deps = parseLockfile('unknown.lock', 'data');
        expect(deps.length).toBe(0);
    });
});

// ── scanDependencies (with mocked fetch) ─────────────────────────────

describe('scanDependencies', () => {
    const originalFetch = globalThis.fetch;

    beforeAll(() => {
        // Mock fetch to simulate OSV API responses
        globalThis.fetch = vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
            if (url.includes('/v1/querybatch')) {
                const body = JSON.parse(options?.body as string);
                const results = body.queries.map((_q: unknown, i: number) => {
                    // Make the first package have a vulnerability
                    if (i === 0) {
                        return { vulns: [{ id: 'GHSA-test-0001', modified: '2024-01-01' }] };
                    }
                    return {};
                });
                return { ok: true, json: async () => ({ results }) };
            }

            if (url.includes('/v1/vulns/')) {
                return {
                    ok: true,
                    json: async () => ({
                        id: 'GHSA-test-0001',
                        summary: 'Test vulnerability in package',
                        severity: [{ type: 'CVSS_V3', score: '7.5' }],
                        affected: [{
                            package: { ecosystem: 'npm', name: 'lodash' },
                            ranges: [{
                                type: 'ECOSYSTEM',
                                events: [{ introduced: '0' }, { fixed: '4.17.22' }],
                            }],
                        }],
                        references: [{ type: 'ADVISORY', url: 'https://github.com/advisories/GHSA-test-0001' }],
                    }),
                };
            }

            return { ok: false, status: 404 };
        });
    });

    afterAll(() => {
        globalThis.fetch = originalFetch;
    });

    test('returns empty for no lockfiles', async () => {
        const issues = await scanDependencies([]);
        expect(issues.length).toBe(0);
    });

    test('scans package-lock.json and returns dependency issues', async () => {
        const lockfile = JSON.stringify({
            lockfileVersion: 2,
            packages: {
                '': { name: 'app', version: '1.0.0' },
                'node_modules/lodash': { version: '4.17.21' },
                'node_modules/express': { version: '4.18.2' },
            },
        });

        const issues = await scanDependencies([{ path: 'package-lock.json', content: lockfile }]);
        expect(issues.length).toBeGreaterThan(0);
        expect(issues[0].type).toBe('dependency');
        expect(issues[0].name).toContain('GHSA-test-0001');
        expect(issues[0].file).toBe('package-lock.json');
        expect(issues[0].description).toContain('Test vulnerability');
        expect(issues[0].description).toContain('4.17.22'); // fixed version
    });

    test('assigns severity from CVSS score', async () => {
        const lockfile = JSON.stringify({
            lockfileVersion: 2,
            packages: {
                '': { name: 'app', version: '1.0.0' },
                'node_modules/lodash': { version: '4.17.21' },
            },
        });

        const issues = await scanDependencies([{ path: 'package-lock.json', content: lockfile }]);
        // CVSS 7.5 = high
        expect(issues[0].severity).toBe('high');
    });

    test('deduplicates dependency issues', async () => {
        const lockfile = JSON.stringify({
            lockfileVersion: 2,
            packages: {
                '': { name: 'app', version: '1.0.0' },
                'node_modules/lodash': { version: '4.17.21' },
            },
        });

        // Scan same lockfile twice
        const issues = await scanDependencies([
            { path: 'package-lock.json', content: lockfile },
            { path: 'apps/web/package-lock.json', content: lockfile },
        ]);
        // Same package@version:vulnId should appear once per source file
        const lodashIssues = issues.filter(i => i.match.includes('lodash'));
        expect(lodashIssues.length).toBeLessThanOrEqual(2); // max 1 per lockfile
    });
});
