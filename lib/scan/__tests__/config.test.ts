import { describe, expect, test } from 'vitest';
import { parseConfig, shouldIgnoreWithConfig, DEFAULT_CONFIG } from '../config';
import { scanFileContent } from '../../../packages/scan/src/scanner/core';

// ── Config Parser ────────────────────────────────────────────────────

describe('parseConfig', () => {
    test('returns defaults for empty content', () => {
        const config = parseConfig('');
        expect(config).toEqual(DEFAULT_CONFIG);
    });

    test('returns defaults for invalid YAML', () => {
        const config = parseConfig(':::not yaml at all{{{');
        expect(config.fail_on).toEqual(['critical', 'high']);
    });

    test('parses ignore patterns', () => {
        const config = parseConfig(`
version: 1
ignore:
  - "**/examples/**"
  - "legacy-code/"
`);
        expect(config.ignore).toEqual(['**/examples/**', 'legacy-code/']);
    });

    test('parses fail_on with valid severities only', () => {
        const config = parseConfig(`
fail_on:
  - critical
  - high
  - banana
  - medium
`);
        expect(config.fail_on).toEqual(['critical', 'high', 'medium']);
    });

    test('parses rules with id and severity', () => {
        const config = parseConfig(`
rules:
  - id: "aws-secret-key"
    severity: "critical"
  - id: "console-log"
    severity: "low"
`);
        expect(config.rules).toHaveLength(2);
        expect(config.rules![0]).toEqual({ id: 'aws-secret-key', severity: 'critical' });
    });

    test('ignores malformed rules', () => {
        const config = parseConfig(`
rules:
  - severity: "critical"
  - id: 123
    severity: true
  - id: "valid"
    severity: "high"
`);
        expect(config.rules).toHaveLength(1);
        expect(config.rules![0].id).toBe('valid');
    });

    test('handles null/non-object YAML', () => {
        expect(parseConfig('null')).toEqual(DEFAULT_CONFIG);
        expect(parseConfig('42')).toEqual(DEFAULT_CONFIG);
        expect(parseConfig('"just a string"')).toEqual(DEFAULT_CONFIG);
    });
});

// ── Path Ignore ──────────────────────────────────────────────────────

describe('shouldIgnoreWithConfig', () => {
    test('returns false with empty ignore list', () => {
        expect(shouldIgnoreWithConfig('src/index.ts', DEFAULT_CONFIG)).toBe(false);
    });

    test('ignores directory prefix', () => {
        const config = parseConfig(`
ignore:
  - "legacy-code/"
`);
        expect(shouldIgnoreWithConfig('legacy-code/old.ts', config)).toBe(true);
        expect(shouldIgnoreWithConfig('src/index.ts', config)).toBe(false);
    });

    test('ignores directory without trailing slash', () => {
        const config = parseConfig(`
ignore:
  - "vendor"
`);
        expect(shouldIgnoreWithConfig('vendor/lib.js', config)).toBe(true);
    });

    test('returns false for non-matching paths', () => {
        const config = parseConfig(`
ignore:
  - "test/"
`);
        expect(shouldIgnoreWithConfig('src/main.ts', config)).toBe(false);
    });
});

// ── In-Code Suppression ──────────────────────────────────────────────

describe('cencori-ignore suppression', () => {
    test('suppresses issue on same line', () => {
        const code = `const x = 1;
const secret = "AKIA1234567890ABCDEF"; // cencori-ignore
const y = 2;`;
        const issues = scanFileContent('test.ts', code);
        const secretIssues = issues.filter(i => i.type === 'secret' && i.line === 2);
        expect(secretIssues).toHaveLength(0);
    });

    test('suppresses issue on next line (comment above)', () => {
        const code = `const x = 1;
// cencori-ignore
const secret = "AKIA1234567890ABCDEF";
const y = 2;`;
        const issues = scanFileContent('test.ts', code);
        const secretIssues = issues.filter(i => i.type === 'secret' && i.line === 3);
        expect(secretIssues).toHaveLength(0);
    });

    test('does NOT suppress unrelated lines', () => {
        const code = `// cencori-ignore
const x = 1;
const secret = "AKIA1234567890ABCDEF";`;
        const issues = scanFileContent('test.ts', code);
        const secretIssues = issues.filter(i => i.type === 'secret' && i.line === 3);
        expect(secretIssues.length).toBeGreaterThan(0);
    });

    test('case-insensitive matching', () => {
        const code = `const x = 1;
const secret = "AKIA1234567890ABCDEF"; // CENCORI-IGNORE
const y = 2;`;
        const issues = scanFileContent('test.ts', code);
        const secretIssues = issues.filter(i => i.type === 'secret' && i.line === 2);
        expect(secretIssues).toHaveLength(0);
    });
});
