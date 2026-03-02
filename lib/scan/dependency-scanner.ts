/**
 * Dependency Scanner — Software Composition Analysis (SCA)
 *
 * Parses lockfiles from scanned repositories and queries the OSV.dev API
 * to detect known vulnerabilities in third-party dependencies.
 *
 * Supported lockfiles:
 *   - package-lock.json (npm v7+)
 *   - yarn.lock (v1 classic)
 *   - pnpm-lock.yaml (v6+)
 *   - requirements.txt (Python pip)
 *   - go.sum (Go modules)
 */

import type { ScanIssue, IssueSeverity } from '../../packages/scan/src/scanner/core';

// ── Types ────────────────────────────────────────────────────────────

export interface ParsedDependency {
    name: string;
    version: string;
    ecosystem: 'npm' | 'PyPI' | 'Go';
}

interface OSVQueryItem {
    package: { ecosystem: string; name: string };
    version: string;
}

interface OSVBatchResponse {
    results: Array<{
        vulns?: Array<{ id: string; modified: string }>;
    }>;
}

interface OSVVulnDetail {
    id: string;
    summary?: string;
    details?: string;
    severity?: Array<{ type: string; score: string }>;
    affected?: Array<{
        package?: { ecosystem: string; name: string };
        ranges?: Array<{
            type: string;
            events: Array<{ introduced?: string; fixed?: string }>;
        }>;
        ecosystem_specific?: { severity?: string };
    }>;
    references?: Array<{ type: string; url: string }>;
}

export interface DependencyFinding {
    dependency: ParsedDependency;
    vulnId: string;
    summary: string;
    severity: IssueSeverity;
    fixedVersion?: string;
    referenceUrl?: string;
}

// ── Lockfile Detection ───────────────────────────────────────────────

const LOCKFILE_NAMES = new Set([
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'requirements.txt',
    'go.sum',
]);

/**
 * Check if a file path is a lockfile we can parse.
 */
export function isLockfile(filePath: string): boolean {
    const basename = filePath.split('/').pop() || '';
    return LOCKFILE_NAMES.has(basename);
}

// ── Lockfile Parsers ─────────────────────────────────────────────────

/**
 * Parse package-lock.json (npm v2/v3 lockfileVersion 2/3 with `packages` key).
 * Falls back to `dependencies` for lockfileVersion 1.
 */
export function parsePackageLock(content: string): ParsedDependency[] {
    const deps: ParsedDependency[] = [];

    try {
        const lockfile = JSON.parse(content);

        // lockfileVersion 2/3 use "packages"
        if (lockfile.packages && typeof lockfile.packages === 'object') {
            for (const [path, meta] of Object.entries(lockfile.packages)) {
                if (!path || path === '') continue; // skip root
                const pkg = meta as { version?: string; name?: string };
                if (!pkg.version) continue;

                // packages keys look like "node_modules/lodash" or "node_modules/@scope/pkg"
                const name = pkg.name || path.replace(/^.*node_modules\//, '');
                if (!name) continue;
                deps.push({ name, version: pkg.version, ecosystem: 'npm' });
            }
        }
        // lockfileVersion 1 uses "dependencies"
        else if (lockfile.dependencies && typeof lockfile.dependencies === 'object') {
            for (const [name, meta] of Object.entries(lockfile.dependencies)) {
                const pkg = meta as { version?: string };
                if (pkg.version) {
                    deps.push({ name, version: pkg.version, ecosystem: 'npm' });
                }
            }
        }
    } catch {
        // Silently skip malformed lockfiles
    }

    return deps;
}

/**
 * Parse yarn.lock (v1 classic format).
 * Entries look like:
 *   "lodash@^4.17.21":
 *     version "4.17.21"
 */
export function parseYarnLock(content: string): ParsedDependency[] {
    const deps: ParsedDependency[] = [];
    const seen = new Set<string>();
    const lines = content.split('\n');

    let currentName: string | null = null;

    for (const line of lines) {
        // Match package entries: "name@version", name@version:
        const headerMatch = line.match(/^"?(@?[^@\s"]+)@[^"]*"?:\s*$/);
        if (headerMatch) {
            currentName = headerMatch[1];
            continue;
        }

        // Match version line
        if (currentName) {
            const versionMatch = line.match(/^\s+version\s+"([^"]+)"/);
            if (versionMatch) {
                const key = `${currentName}@${versionMatch[1]}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    deps.push({ name: currentName, version: versionMatch[1], ecosystem: 'npm' });
                }
                currentName = null;
            }
        }
    }

    return deps;
}

/**
 * Parse pnpm-lock.yaml (v6+ format).
 * Looks for the `packages:` section with entries like:
 *   /lodash@4.17.21:
 * or (v9+):
 *   lodash@4.17.21:
 */
export function parsePnpmLock(content: string): ParsedDependency[] {
    const deps: ParsedDependency[] = [];
    const seen = new Set<string>();

    // Match package entries in the packages section
    const packageEntryRegex = /^\s{2}\/?(@?[^@\s/][^@\s]*)@(\d+\.\d+[^:\s]*):/gm;
    let match: RegExpExecArray | null;

    while ((match = packageEntryRegex.exec(content)) !== null) {
        const name = match[1];
        const version = match[2];
        const key = `${name}@${version}`;
        if (!seen.has(key)) {
            seen.add(key);
            deps.push({ name, version, ecosystem: 'npm' });
        }
    }

    return deps;
}

/**
 * Parse requirements.txt (Python pip).
 * Lines like: flask==2.3.2 or requests>=2.28.0,<3.0
 * We only extract pinned versions (==) for accurate CVE lookup.
 */
export function parseRequirementsTxt(content: string): ParsedDependency[] {
    const deps: ParsedDependency[] = [];
    const lines = content.split('\n');

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#') || line.startsWith('-')) continue;

        // Match pinned versions: package==1.2.3
        const pinnedMatch = line.match(/^([a-zA-Z0-9_.-]+)==([^\s;#]+)/);
        if (pinnedMatch) {
            deps.push({
                name: pinnedMatch[1].toLowerCase(),
                version: pinnedMatch[2],
                ecosystem: 'PyPI',
            });
        }
    }

    return deps;
}

/**
 * Parse go.sum — entries like:
 *   github.com/pkg/errors v0.9.1 h1:...
 *   github.com/pkg/errors v0.9.1/go.mod h1:...
 */
export function parseGoSum(content: string): ParsedDependency[] {
    const deps: ParsedDependency[] = [];
    const seen = new Set<string>();
    const lines = content.split('\n');

    for (const line of lines) {
        const match = line.match(/^(\S+)\s+(v\S+?)(?:\/go\.mod)?\s+/);
        if (match) {
            const name = match[1];
            const version = match[2].replace(/^v/, '');
            const key = `${name}@${version}`;
            if (!seen.has(key)) {
                seen.add(key);
                deps.push({ name, version, ecosystem: 'Go' });
            }
        }
    }

    return deps;
}

// ── Unified Parser ───────────────────────────────────────────────────

/**
 * Parse a lockfile by its filename and return extracted dependencies.
 */
export function parseLockfile(filename: string, content: string): ParsedDependency[] {
    const basename = filename.split('/').pop() || '';

    switch (basename) {
        case 'package-lock.json':
            return parsePackageLock(content);
        case 'yarn.lock':
            return parseYarnLock(content);
        case 'pnpm-lock.yaml':
            return parsePnpmLock(content);
        case 'requirements.txt':
            return parseRequirementsTxt(content);
        case 'go.sum':
            return parseGoSum(content);
        default:
            return [];
    }
}

// ── OSV API Client ───────────────────────────────────────────────────

const OSV_BATCH_URL = 'https://api.osv.dev/v1/querybatch';
const OSV_VULN_URL = 'https://api.osv.dev/v1/vulns';
const BATCH_SIZE = 500;
const OSV_TIMEOUT_MS = 15_000;

/**
 * Query OSV.dev for known vulnerabilities in a batch of dependencies.
 * Returns only dependencies that have at least one vulnerability.
 */
async function queryOSVBatch(
    dependencies: ParsedDependency[]
): Promise<Map<number, string[]>> {
    const vulnMap = new Map<number, string[]>();

    // Process in batches
    for (let offset = 0; offset < dependencies.length; offset += BATCH_SIZE) {
        const batch = dependencies.slice(offset, offset + BATCH_SIZE);
        const queries: OSVQueryItem[] = batch.map(dep => ({
            package: { ecosystem: dep.ecosystem, name: dep.name },
            version: dep.version,
        }));

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), OSV_TIMEOUT_MS);

            const response = await fetch(OSV_BATCH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ queries }),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                console.warn(`[Dependency Scanner] OSV batch query failed: ${response.status}`);
                continue;
            }

            const data = (await response.json()) as OSVBatchResponse;

            for (let i = 0; i < data.results.length; i++) {
                const result = data.results[i];
                if (result.vulns && result.vulns.length > 0) {
                    const globalIndex = offset + i;
                    vulnMap.set(
                        globalIndex,
                        result.vulns.map(v => v.id)
                    );
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            console.warn(`[Dependency Scanner] OSV batch query error: ${message}`);
        }
    }

    return vulnMap;
}

/**
 * Fetch full vulnerability details from OSV.dev for a given ID.
 */
async function fetchVulnDetail(vulnId: string): Promise<OSVVulnDetail | null> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), OSV_TIMEOUT_MS);

        const response = await fetch(`${OSV_VULN_URL}/${vulnId}`, {
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) return null;
        return (await response.json()) as OSVVulnDetail;
    } catch {
        return null;
    }
}

/**
 * Derive severity from OSV vulnerability detail.
 */
function deriveSeverity(vuln: OSVVulnDetail): IssueSeverity {
    // Check CVSS score first
    if (vuln.severity && vuln.severity.length > 0) {
        for (const s of vuln.severity) {
            if (s.type === 'CVSS_V3' || s.type === 'CVSS_V2') {
                const score = parseFloat(s.score);
                if (!isNaN(score)) {
                    if (score >= 9.0) return 'critical';
                    if (score >= 7.0) return 'high';
                    if (score >= 4.0) return 'medium';
                    return 'low';
                }
            }
        }
    }

    // Fallback to ecosystem_specific severity
    if (vuln.affected) {
        for (const affected of vuln.affected) {
            const ecosystemSeverity = affected.ecosystem_specific?.severity?.toUpperCase();
            if (ecosystemSeverity === 'CRITICAL') return 'critical';
            if (ecosystemSeverity === 'HIGH') return 'high';
            if (ecosystemSeverity === 'MODERATE' || ecosystemSeverity === 'MEDIUM') return 'medium';
            if (ecosystemSeverity === 'LOW') return 'low';
        }
    }

    // Fallback based on ID prefix
    if (vuln.id.startsWith('GHSA-')) return 'high';
    return 'medium';
}

/**
 * Extract the fixed version from vulnerability ranges.
 */
function extractFixedVersion(vuln: OSVVulnDetail, packageName: string): string | undefined {
    if (!vuln.affected) return undefined;

    for (const affected of vuln.affected) {
        if (affected.package?.name !== packageName) continue;

        for (const range of affected.ranges || []) {
            for (const event of range.events) {
                if (event.fixed) return event.fixed;
            }
        }
    }

    return undefined;
}

/**
 * Extract reference URL for a vulnerability.
 */
function extractReferenceUrl(vuln: OSVVulnDetail): string | undefined {
    if (!vuln.references || vuln.references.length === 0) return undefined;

    // Prefer advisory URLs
    const advisory = vuln.references.find(r => r.type === 'ADVISORY');
    if (advisory) return advisory.url;

    // Fall back to any WEB reference
    const web = vuln.references.find(r => r.type === 'WEB');
    if (web) return web.url;

    return vuln.references[0]?.url;
}

// ── Main Scanner ─────────────────────────────────────────────────────

/**
 * Scan dependency lockfiles for known vulnerabilities.
 *
 * @param lockfiles - Array of {path, content} for detected lockfiles
 * @returns ScanIssue[] with type 'dependency'
 */
export async function scanDependencies(
    lockfiles: Array<{ path: string; content: string }>
): Promise<ScanIssue[]> {
    if (lockfiles.length === 0) return [];

    // 1. Parse all lockfiles
    const allDeps: ParsedDependency[] = [];
    const depSourceFile = new Map<number, string>();

    for (const lockfile of lockfiles) {
        const parsed = parseLockfile(lockfile.path, lockfile.content);
        for (const dep of parsed) {
            depSourceFile.set(allDeps.length, lockfile.path);
            allDeps.push(dep);
        }
    }

    if (allDeps.length === 0) return [];

    console.log(`[Dependency Scanner] Parsed ${allDeps.length} dependencies from ${lockfiles.length} lockfile(s)`);

    // 2. Query OSV for vulnerabilities
    const vulnMap = await queryOSVBatch(allDeps);

    if (vulnMap.size === 0) {
        console.log('[Dependency Scanner] No known vulnerabilities found');
        return [];
    }

    console.log(`[Dependency Scanner] Found vulnerabilities in ${vulnMap.size} package(s)`);

    // 3. Fetch details for each vulnerability (limit concurrent requests)
    const uniqueVulnIds = new Set<string>();
    for (const ids of vulnMap.values()) {
        for (const id of ids) uniqueVulnIds.add(id);
    }

    // Cap at 50 unique CVEs to avoid hammering the API
    const vulnIdsToFetch = Array.from(uniqueVulnIds).slice(0, 50);
    const vulnDetails = new Map<string, OSVVulnDetail>();

    // Fetch in parallel with concurrency limit of 10
    const CONCURRENCY = 10;
    for (let i = 0; i < vulnIdsToFetch.length; i += CONCURRENCY) {
        const chunk = vulnIdsToFetch.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
            chunk.map(async (id) => {
                const detail = await fetchVulnDetail(id);
                return { id, detail };
            })
        );
        for (const { id, detail } of results) {
            if (detail) vulnDetails.set(id, detail);
        }
    }

    // 4. Generate ScanIssues
    const issues: ScanIssue[] = [];
    const seenIssueKeys = new Set<string>();

    for (const [depIndex, vulnIds] of vulnMap.entries()) {
        const dep = allDeps[depIndex];
        const sourceFile = depSourceFile.get(depIndex) || 'unknown';

        for (const vulnId of vulnIds) {
            const issueKey = `${dep.name}@${dep.version}:${vulnId}`;
            if (seenIssueKeys.has(issueKey)) continue;
            seenIssueKeys.add(issueKey);

            const detail = vulnDetails.get(vulnId);
            const severity = detail ? deriveSeverity(detail) : 'medium';
            const summary = detail?.summary || `Known vulnerability in ${dep.name}`;
            const fixedVersion = detail ? extractFixedVersion(detail, dep.name) : undefined;
            const referenceUrl = detail ? extractReferenceUrl(detail) : undefined;

            const fixHint = fixedVersion ? ` — upgrade to ${fixedVersion}` : '';
            const refHint = referenceUrl ? ` (${referenceUrl})` : '';

            issues.push({
                type: 'dependency',
                severity,
                name: `${vulnId} in ${dep.name}@${dep.version}`,
                file: sourceFile,
                line: 1,
                column: 1,
                match: `${dep.name}@${dep.version}`,
                description: `${summary}${fixHint}${refHint}`,
            });
        }
    }

    console.log(`[Dependency Scanner] Generated ${issues.length} dependency finding(s)`);

    // Sort by severity (critical first)
    const severityOrder: Record<IssueSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
