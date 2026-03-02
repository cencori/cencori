import { describe, expect, test, vi, beforeAll, afterAll } from 'vitest';
import { verifyWebhookSignature } from '../webhook-verify';
import { formatPRComment } from '../pr-comment';
import type { PRCommentOptions } from '../pr-comment';
import type { ScanIssue, ScanScore } from '../../../packages/scan/src/scanner/core';
import { createHmac } from 'crypto';

// ── Webhook Signature Verification ───────────────────────────────────

describe('verifyWebhookSignature', () => {
    const ORIGINAL_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

    beforeAll(() => {
        process.env.GITHUB_WEBHOOK_SECRET = 'test-secret-key';
    });

    afterAll(() => {
        if (ORIGINAL_SECRET) {
            process.env.GITHUB_WEBHOOK_SECRET = ORIGINAL_SECRET;
        } else {
            delete process.env.GITHUB_WEBHOOK_SECRET;
        }
    });

    test('accepts valid signature', () => {
        const payload = '{"action":"opened"}';
        const signature = 'sha256=' + createHmac('sha256', 'test-secret-key')
            .update(payload)
            .digest('hex');
        expect(verifyWebhookSignature(payload, signature)).toBe(true);
    });

    test('rejects invalid signature', () => {
        const payload = '{"action":"opened"}';
        expect(verifyWebhookSignature(payload, 'sha256=invalid')).toBe(false);
    });

    test('rejects null signature', () => {
        const payload = '{"action":"opened"}';
        expect(verifyWebhookSignature(payload, null)).toBe(false);
    });

    test('rejects tampered payload', () => {
        const original = '{"action":"opened"}';
        const signature = 'sha256=' + createHmac('sha256', 'test-secret-key')
            .update(original)
            .digest('hex');
        expect(verifyWebhookSignature('{"action":"tampered"}', signature)).toBe(false);
    });
});

// ── PR Comment Formatting ────────────────────────────────────────────

describe('formatPRComment', () => {
    const baseOptions: Omit<PRCommentOptions, 'newIssues' | 'totalIssues' | 'score'> = {
        octokit: { request: vi.fn() },
        owner: 'testorg',
        repo: 'testrepo',
        pullNumber: 42,
        headSha: 'abc1234567890',
        scanDurationMs: 3500,
        filesScanned: 25,
    };

    test('shows success message when no new issues', () => {
        const comment = formatPRComment({
            ...baseOptions,
            newIssues: [],
            totalIssues: 5,
            score: 'B' as ScanScore,
        });

        expect(comment).toContain('Cencori Security Review');
        expect(comment).toContain('No new security issues');
        expect(comment).toContain('5 pre-existing issue');
        expect(comment).toContain('cencori-scan-review');
    });

    test('shows clean message when no issues at all', () => {
        const comment = formatPRComment({
            ...baseOptions,
            newIssues: [],
            totalIssues: 0,
            score: 'A' as ScanScore,
        });

        expect(comment).toContain('No new security issues');
        expect(comment).toContain('Repository is clean');
    });

    test('shows issues table when new issues found', () => {
        const issues: ScanIssue[] = [
            {
                type: 'secret',
                severity: 'critical',
                name: 'AWS Secret Key',
                file: 'config/aws.ts',
                line: 14,
                column: 1,
                match: 'AKIA****1234',
            },
            {
                type: 'vulnerability',
                severity: 'medium',
                name: 'eval() usage',
                file: 'api/exec.ts',
                line: 42,
                column: 5,
                match: 'eval(input)',
            },
        ];

        const comment = formatPRComment({
            ...baseOptions,
            newIssues: issues,
            totalIssues: 7,
            score: 'C' as ScanScore,
        });

        expect(comment).toContain('2 new issues');
        expect(comment).toContain('AWS Secret Key');
        expect(comment).toContain('eval() usage');
        expect(comment).toContain('🔴 Critical');
        expect(comment).toContain('🟡 Medium');
        expect(comment).toContain('`config/aws.ts:14`');
    });

    test('shows score delta when provided', () => {
        const comment = formatPRComment({
            ...baseOptions,
            newIssues: [{
                type: 'secret',
                severity: 'critical',
                name: 'API Key',
                file: 'index.ts',
                line: 1,
                column: 1,
                match: 'sk_live_xxx',
            }],
            totalIssues: 1,
            score: 'F' as ScanScore,
            previousScore: 'B' as ScanScore,
        });

        expect(comment).toContain('**B → F**');
    });

    test('shows dependency icon for dependency issues', () => {
        const issues: ScanIssue[] = [{
            type: 'dependency',
            severity: 'high',
            name: 'GHSA-1234 in lodash@4.17.15',
            file: 'package-lock.json',
            line: 1,
            column: 1,
            match: 'lodash@4.17.15',
        }];

        const comment = formatPRComment({
            ...baseOptions,
            newIssues: issues,
            totalIssues: 1,
            score: 'D' as ScanScore,
        });

        expect(comment).toContain('📦');
    });

    test('caps at 15 issues and shows remaining count', () => {
        const issues: ScanIssue[] = Array.from({ length: 20 }, (_, i) => ({
            type: 'vulnerability' as const,
            severity: 'medium' as const,
            name: `Issue ${i + 1}`,
            file: `file${i}.ts`,
            line: 1,
            column: 1,
            match: `match${i}`,
        }));

        const comment = formatPRComment({
            ...baseOptions,
            newIssues: issues,
            totalIssues: 20,
            score: 'D' as ScanScore,
        });

        expect(comment).toContain('5 more issues');
    });

    test('shows inline count when diffLineMap provided with matching lines', () => {
        const issues: ScanIssue[] = [
            { type: 'secret', severity: 'critical', name: 'Key', file: 'src/config.ts', line: 5, column: 1, match: 'AKIA' },
            { type: 'vulnerability', severity: 'medium', name: 'eval', file: 'src/exec.ts', line: 10, column: 1, match: 'eval()' },
        ];

        const diffLineMap = new Map<string, Set<number>>([
            ['src/config.ts', new Set([3, 4, 5, 6, 7])],
        ]);

        const comment = formatPRComment({
            ...baseOptions,
            newIssues: issues,
            totalIssues: 2,
            score: 'C' as ScanScore,
            diffLineMap,
        });

        expect(comment).toContain('1 marked inline');
    });
});

// ── Diff-Aware Issue Detection ───────────────────────────────────────

describe('Diff-aware New Issue Detection', () => {
    test('identifies new issues not in base', () => {
        const headIssues: ScanIssue[] = [
            { type: 'secret', severity: 'critical', name: 'AWS Key', file: 'config.ts', line: 1, column: 1, match: 'AKIA1234' },
            { type: 'vulnerability', severity: 'medium', name: 'eval', file: 'api.ts', line: 5, column: 1, match: 'eval(x)' },
        ];

        const baseIssues: ScanIssue[] = [
            { type: 'secret', severity: 'critical', name: 'AWS Key', file: 'config.ts', line: 1, column: 1, match: 'AKIA1234' },
        ];

        const baseFingerprints = new Set(
            baseIssues.map(i => `${i.type}:${i.name}:${i.file}:${i.match}`)
        );

        const newIssues = headIssues.filter(issue => {
            const fp = `${issue.type}:${issue.name}:${issue.file}:${issue.match}`;
            return !baseFingerprints.has(fp);
        });

        expect(newIssues.length).toBe(1);
        expect(newIssues[0].name).toBe('eval');
    });

    test('returns all issues when base is empty (new file)', () => {
        const headIssues: ScanIssue[] = [
            { type: 'secret', severity: 'critical', name: 'Key', file: 'new.ts', line: 1, column: 1, match: 'AKIA' },
        ];

        const baseFingerprints = new Set<string>();
        const newIssues = headIssues.filter(issue => {
            const fp = `${issue.type}:${issue.name}:${issue.file}:${issue.match}`;
            return !baseFingerprints.has(fp);
        });

        expect(newIssues.length).toBe(1);
    });

    test('returns empty when no new issues', () => {
        const issues: ScanIssue[] = [
            { type: 'secret', severity: 'critical', name: 'Key', file: 'old.ts', line: 1, column: 1, match: 'AKIA' },
        ];

        const baseFingerprints = new Set(
            issues.map(i => `${i.type}:${i.name}:${i.file}:${i.match}`)
        );

        const newIssues = issues.filter(issue => {
            const fp = `${issue.type}:${issue.name}:${issue.file}:${issue.match}`;
            return !baseFingerprints.has(fp);
        });

        expect(newIssues.length).toBe(0);
    });
});

// ── Patch Line Parser ────────────────────────────────────────────────

describe('Patch line parsing (via diffLineMap in formatPRComment)', () => {
    test('diffLineMap correctly identifies issues on visible diff lines', () => {
        // Simulating what parsePatchLines would produce for a patch like:
        // @@ -1,3 +1,5 @@
        //  const x = 1;
        //  const y = 2;
        // +const secret = 'AKIA1234';
        // +const z = 3;
        //  export default x;
        const diffLines = new Set([3, 4]); // lines 3 and 4 are added
        const diffLineMap = new Map([['config.ts', diffLines]]);

        const issueOnDiffLine: ScanIssue = {
            type: 'secret', severity: 'critical', name: 'Key',
            file: 'config.ts', line: 3, column: 1, match: 'AKIA1234',
        };
        const issueOffDiffLine: ScanIssue = {
            type: 'secret', severity: 'critical', name: 'OldKey',
            file: 'config.ts', line: 10, column: 1, match: 'OLDKEY',
        };

        // Test that formatPRComment mentions inline count
        const comment = formatPRComment({
            octokit: { request: vi.fn() },
            owner: 'test',
            repo: 'test',
            pullNumber: 1,
            headSha: 'abc123',
            newIssues: [issueOnDiffLine, issueOffDiffLine],
            totalIssues: 2,
            score: 'D' as ScanScore,
            scanDurationMs: 1000,
            filesScanned: 1,
            diffLineMap,
        });

        expect(comment).toContain('1 marked inline');
    });
});
