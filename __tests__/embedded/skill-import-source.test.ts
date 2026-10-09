import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import {
    extractSkillZip,
    githubCodeloadUrl,
    htmlToReadableText,
    looksLikeHtml,
    parseGitHubTarget,
    repoFilterNotice,
    sanitizeRef,
    sanitizeSubdir,
    SkillImportSourceError,
    SKILL_IMPORT_MAX_ZIP_ENTRIES,
} from '@/lib/embedded/skill-import-source';
import { SKILL_MAX_FILE_BYTES, SKILL_MAX_TOTAL_BYTES } from '@/lib/embedded/skill-scan';

async function makeZip(entries: Record<string, string>): Promise<Buffer> {
    const zip = new JSZip();
    for (const [name, content] of Object.entries(entries)) {
        zip.file(name, content);
    }
    return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
}

describe('parseGitHubTarget', () => {
    it('parses a plain repo URL to HEAD + whole repo', () => {
        expect(parseGitHubTarget('https://github.com/acme/widgets')).toEqual({ owner: 'acme', repo: 'widgets', ref: 'HEAD', subdir: null });
    });

    it('strips .git suffix', () => {
        expect(parseGitHubTarget('https://github.com/acme/widgets.git')?.repo).toBe('widgets');
    });

    it('accepts owner/repo shorthand', () => {
        expect(parseGitHubTarget('acme/widgets')).toEqual({ owner: 'acme', repo: 'widgets', ref: 'HEAD', subdir: null });
    });

    it('derives ref + subdir from tree deep links', () => {
        expect(parseGitHubTarget('https://github.com/acme/widgets/tree/main/docs/policies')).toEqual({
            owner: 'acme',
            repo: 'widgets',
            ref: 'main',
            subdir: 'docs/policies',
        });
    });

    it('derives ref from blob links without keeping the filename as subdir', () => {
        const target = parseGitHubTarget('https://github.com/acme/widgets/blob/v2.1/SKILL.md');
        expect(target).toEqual({ owner: 'acme', repo: 'widgets', ref: 'v2.1', subdir: null });
    });

    it('lets explicit ref/subdir win over URL-derived values', () => {
        const target = parseGitHubTarget('https://github.com/acme/widgets/tree/main/docs', { ref: 'v1', subdir: 'other' });
        expect(target).toEqual({ owner: 'acme', repo: 'widgets', ref: 'v1', subdir: 'other' });
    });

    it('returns null for non-GitHub input', () => {
        expect(parseGitHubTarget('https://example.com/acme/widgets')).toBeNull();
        expect(parseGitHubTarget('not a repo')).toBeNull();
    });
});

describe('sanitizeRef / sanitizeSubdir', () => {
    it('accepts branches, tags, and SHAs', () => {
        expect(sanitizeRef('main')).toBe('main');
        expect(sanitizeRef('v2.1.0')).toBe('v2.1.0');
        expect(sanitizeRef('feature/my-branch_1')).toBe('feature/my-branch_1');
    });

    it('rejects traversal and shell metacharacters', () => {
        expect(() => sanitizeRef('../evil')).toThrow(SkillImportSourceError);
        expect(() => sanitizeRef('main; rm -rf')).toThrow(SkillImportSourceError);
        expect(() => sanitizeRef('')).toThrow(SkillImportSourceError);
    });

    it('rejects traversal subdirs', () => {
        expect(sanitizeSubdir('docs/policies')).toBe('docs/policies');
        expect(() => sanitizeSubdir('../../etc')).toThrow(SkillImportSourceError);
        expect(sanitizeSubdir('/absolute')).toBe('absolute');
    });
});

describe('githubCodeloadUrl', () => {
    it('builds a codeload zip URL for the ref', () => {
        expect(githubCodeloadUrl('acme', 'widgets', 'main')).toBe('https://codeload.github.com/acme/widgets/zip/main');
    });
});

describe('looksLikeHtml', () => {
    it('trusts text/html content types', () => {
        expect(looksLikeHtml('text/html; charset=utf-8', '# hello')).toBe(true);
    });

    it('sniffs HTML bodies served as text/plain', () => {
        expect(looksLikeHtml('text/plain', '<!DOCTYPE html><html><body>hi</body></html>')).toBe(true);
        expect(looksLikeHtml('', '# Just markdown\n\nno tags here')).toBe(false);
    });
});

describe('htmlToReadableText', () => {
    it('extracts readable text and drops scripts/styles', () => {
        const { text } = htmlToReadableText(
            '<html><head><title>Refund Policy</title><style>.x{color:red}</style><script>alert(1)</script></head><body><h1>Refunds</h1><p>30 days &amp; free returns.</p></body></html>',
            'https://example.com/refunds',
        );
        expect(text).toContain('# Source: https://example.com/refunds');
        expect(text).toContain('Refund Policy');
        expect(text).toContain('30 days & free returns.');
        expect(text).not.toContain('alert(1)');
        expect(text).not.toContain('<h1>');
    });

    it('throws when nothing readable remains', () => {
        expect(() => htmlToReadableText('<html><body><script>var x = 1;</script></body></html>', 'https://example.com/empty')).toThrow(
            SkillImportSourceError,
        );
    });
});

describe('extractSkillZip', () => {
    it('strips the codeload wrapper and keeps markdown while skipping clutter', async () => {
        const buffer = await makeZip({
            'widgets-HEAD/SKILL.md': '# Guide',
            'widgets-HEAD/docs/notes.txt': 'hello',
            'widgets-HEAD/src/index.js': 'console.log(1)',
            'widgets-HEAD/node_modules/dep/README.md': '# dep',
            'widgets-HEAD/.git/config': '[core]',
            'widgets-HEAD/logo.png': 'binary',
        });
        const result = await extractSkillZip(buffer, { source: 'test' });
        expect(result.files.map((f) => f.path).sort()).toEqual(['SKILL.md', 'docs/notes.txt']);
        expect(result.skippedNonText).toBeGreaterThanOrEqual(2);
        expect(result.skippedIgnored).toBeGreaterThanOrEqual(2);
    });

    it('scopes to a subdir before enforcing caps', async () => {
        const buffer = await makeZip({
            'repo-HEAD/docs/a.md': 'a',
            'repo-HEAD/docs/b.md': 'b',
            'repo-HEAD/other/c.md': 'c',
        });
        const result = await extractSkillZip(buffer, { subdir: 'docs' });
        expect(result.files.map((f) => f.path).sort()).toEqual(['a.md', 'b.md']);
    });

    it('throws a detailed error for oversized single files', async () => {
        const buffer = await makeZip({ 'big.md': 'x'.repeat(SKILL_MAX_FILE_BYTES + 1) });
        const err = await extractSkillZip(buffer).catch((e) => e);
        expect(err).toBeInstanceOf(SkillImportSourceError);
        expect(err.status).toBe(413);
        expect(err.details.actual_bytes).toBeGreaterThan(SKILL_MAX_FILE_BYTES);
        expect(err.details.limit_bytes).toBe(SKILL_MAX_FILE_BYTES);
        expect(err.details.path).toContain('big.md');
    });

    it('throws a detailed error past the total-bytes cap', async () => {
        const chunk = 'y'.repeat(150 * 1024);
        const entries: Record<string, string> = {};
        for (let i = 0; i < 15; i++) entries[`f${i}.md`] = chunk;
        const buffer = await makeZip(entries);
        const err = await extractSkillZip(buffer, { source: 'big-repo' }).catch((e) => e);
        expect(err).toBeInstanceOf(SkillImportSourceError);
        expect(err.status).toBe(413);
        expect(err.details.limit_bytes).toBe(SKILL_MAX_TOTAL_BYTES);
        expect(err.details.actual_bytes).toBeGreaterThan(SKILL_MAX_TOTAL_BYTES);
    });

    it('throws a detailed error past the file-count cap', async () => {
        const entries: Record<string, string> = {};
        for (let i = 0; i < 55; i++) entries[`f${i}.md`] = 'ok';
        const buffer = await makeZip(entries);
        const err = await extractSkillZip(buffer).catch((e) => e);
        expect(err).toBeInstanceOf(SkillImportSourceError);
        expect(err.status).toBe(413);
        expect(err.message).toContain('subdir');
    });

    it('exposes the scan cap', () => {
        expect(SKILL_IMPORT_MAX_ZIP_ENTRIES).toBeGreaterThan(50);
    });
});

describe('repoFilterNotice', () => {
    it('returns null when nothing was skipped', () => {
        expect(repoFilterNotice({ skippedNonText: 0, skippedIgnored: 0 }, null)).toBeNull();
    });

    it('summarizes skipped files with scope', () => {
        const notice = repoFilterNotice({ skippedNonText: 3, skippedIgnored: 1 }, 'docs')!;
        expect(notice.code).toBe('repo_filtered');
        expect(notice.message).toContain('3 non-text');
        expect(notice.message).toContain('docs');
    });
});
