import {
    SKILL_ALLOWED_EXTENSIONS,
    SKILL_MAX_FILES,
    SKILL_MAX_FILE_BYTES,
    SKILL_MAX_TOTAL_BYTES,
    type SkillFile,
} from './skill-scan';

/**
 * Shared import-source helpers for POST /v1/skill-imports.
 *
 * Kept free of Next.js / Supabase imports so the pure logic is unit-testable.
 * Error callers keep the stable envelope code `invalid_request_error` and
 * attach these details under `error.details` for traceability.
 */
export class SkillImportSourceError extends Error {
    status: number;
    details: Record<string, unknown>;
    constructor(status: number, message: string, details: Record<string, unknown> = {}) {
        super(message);
        this.name = 'SkillImportSourceError';
        this.status = status;
        this.details = details;
    }
}

export interface ImportNotice {
    code: string;
    message: string;
}

/** Upper bound on zip entries scanned (zip-bomb CPU guard; 2MB total cap binds first). */
export const SKILL_IMPORT_MAX_ZIP_ENTRIES = 2000;

const IGNORED_DIR_SEGMENTS = new Set(['.git', 'node_modules', '__MACOSX']);
const REF_PATTERN = /^[A-Za-z0-9._/-]+$/;
const MAX_REF_LENGTH = 128;
const MAX_SUBDIR_LENGTH = 256;

const HTML_SNIFF = /<\s*!doctype\s+html|<\s*html[\s>]|<\s*(head|body|article|main|div|section)[\s>]/i;

export function sanitizeRef(ref: string): string {
    const trimmed = ref.trim().replace(/^refs\/heads\//, '');
    if (!trimmed || trimmed.length > MAX_REF_LENGTH || !REF_PATTERN.test(trimmed) || trimmed.includes('..')) {
        throw new SkillImportSourceError(400, `Invalid ref "${ref.slice(0, 64)}"; use a branch, tag, or commit SHA`, {
            param: 'ref',
            ref: ref.slice(0, MAX_REF_LENGTH),
        });
    }
    return trimmed;
}

export function sanitizeSubdir(subdir: string): string {
    const trimmed = subdir.trim().replace(/^\.\//, '').replace(/^\/+|\/+$/g, '');
    if (
        !trimmed ||
        trimmed.length > MAX_SUBDIR_LENGTH ||
        trimmed.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')
    ) {
        throw new SkillImportSourceError(400, `Invalid subdir "${subdir.slice(0, 64)}"; use a repo-relative directory path`, {
            param: 'subdir',
            subdir: subdir.slice(0, MAX_SUBDIR_LENGTH),
        });
    }
    return trimmed;
}

export interface GitHubTarget {
    owner: string;
    repo: string;
    /** Branch/tag/SHA; defaults to HEAD when not derivable. */
    ref: string;
    /** Repo-relative subdirectory; null means the whole repo. */
    subdir: string | null;
}

/**
 * Parse a `repository` value into owner/repo plus optional ref/subdir.
 * Accepts full github.com URLs (including /tree/ and /blob/ deep links and
 * .git suffixes), `owner/repo` shorthand, and explicit `ref`/`subdir`
 * overrides (explicit wins over URL-derived values).
 */
export function parseGitHubTarget(
    repository: string,
    opts: { ref?: string; subdir?: string; branch?: string; path?: string } = {},
): GitHubTarget | null {
    const input = repository.trim();
    if (!input) return null;

    let owner: string | undefined;
    let repo: string | undefined;
    let urlRef: string | undefined;
    let urlSubdir: string | undefined;

    const urlMatch = input.match(/^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)([\/?#].*)?$/i);
    if (urlMatch) {
        owner = urlMatch[1];
        repo = urlMatch[2].replace(/\.git$/i, '');
        const rest = urlMatch[3] ?? '';
        const treeMatch = rest.match(/^\/tree\/([^/]+)(?:\/(.+?))?[\/?#]?$/);
        const blobMatch = rest.match(/^\/blob\/([^/]+)(?:\/(.+?))?[\/?#]?$/);
        if (treeMatch) {
            urlRef = decodeURIComponent(treeMatch[1]);
            urlSubdir = treeMatch[2] ? decodeURIComponent(treeMatch[2].replace(/\/$/, '')) : undefined;
        } else if (blobMatch) {
            urlRef = decodeURIComponent(blobMatch[1]);
            urlSubdir = blobMatch[2] ? decodeURIComponent(blobMatch[2].replace(/\/$/, '')) : undefined;
        }
    } else {
        const shortMatch = input.match(/^([^/\s]+)\/([^/\s]+?)(\.git)?$/);
        if (!shortMatch) return null;
        owner = shortMatch[1];
        repo = shortMatch[2];
    }

    if (!owner || !repo) return null;

    const explicitRef = opts.ref ?? opts.branch;
    const explicitSubdir = opts.subdir ?? opts.path;
    const ref = explicitRef !== undefined && explicitRef !== '' ? sanitizeRef(explicitRef) : urlRef ? sanitizeRef(urlRef) : 'HEAD';
    let subdir: string | null = null;
    if (explicitSubdir !== undefined && explicitSubdir !== '') {
        subdir = sanitizeSubdir(explicitSubdir);
    } else if (urlSubdir) {
        const fileMatch = urlSubdir.match(/\.(md|markdown|mdx|txt)$/i);
        if (fileMatch) {
            // Blob link to a single file: scope to its directory (null at root).
            const slash = urlSubdir.lastIndexOf('/');
            subdir = slash > 0 ? sanitizeSubdir(urlSubdir.slice(0, slash)) : null;
        } else {
            subdir = sanitizeSubdir(urlSubdir);
        }
    }
    return { owner, repo, ref, subdir };
}

export function githubCodeloadUrl(owner: string, repo: string, ref = 'HEAD'): string {
    return `https://codeload.github.com/${owner}/${repo}/zip/${encodeURIComponent(sanitizeRef(ref))}`;
}

export function looksLikeHtml(contentType: string, head: string): boolean {
    if (/text\/html/i.test(contentType)) return true;
    return HTML_SNIFF.test(head.slice(0, 2048));
}

function decodeEntities(text: string): string {
    return text
        .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
            try {
                return String.fromCodePoint(parseInt(hex, 16));
            } catch {
                return '';
            }
        })
        .replace(/&#(\d+);/g, (_, dec: string) => {
            try {
                return String.fromCodePoint(parseInt(dec, 10));
            } catch {
                return '';
            }
        })
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'");
}

/**
 * Convert an HTML page to readable plain text for skill import.
 * Strips navigation/chrome tags, keeps headings/paragraphs/list structure
 * as line breaks, and throws when nothing readable remains.
 */
export function htmlToReadableText(html: string, sourceUrl: string): { text: string; title: string | null } {
    const title = html.match(/<title[^>]*>([\s\S]{1,300})<\/title>/i)?.[1]?.trim() || null;
    let text = html
        .replace(/<script[\s\S]*?<\/script\s*>/gi, '\n')
        .replace(/<style[\s\S]*?<\/style\s*>/gi, '\n')
        .replace(/<(noscript|template|iframe|svg|canvas|nav|footer)[\s\S]*?<\/\1\s*>/gi, '\n')
        .replace(/<!--[\s\S]*?-->/g, '\n')
        .replace(/<\s*(h[1-6]|p|div|section|article|header|li|tr|blockquote|pre|hr|br)[^>]*>/gi, '\n')
        .replace(/<\s*\/\s*(h[1-6]|p|div|section|article|header|li|tr|blockquote|pre)[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, ' ');
    text = decodeEntities(text)
        .split('\n')
        .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
        .filter((line) => line.length > 0)
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    if (!text) {
        throw new SkillImportSourceError(422, `URL returned HTML with no readable text: ${sourceUrl.slice(0, 200)}`, {
            source: sourceUrl.slice(0, 1000),
            content_type: 'text/html',
        });
    }
    const header = `# Source: ${sourceUrl}${title ? `\n# Title: ${title}` : ''}\n\n`;
    return { text: header + text, title };
}

function stripCodeloadPrefix(path: string): string {
    const segments = path.split('/');
    // codeload zips nest everything under `<repo>-<ref>/…`; drop that wrapper
    // only when every collected path shares it (uploads keep their layout).
    return segments.length > 1 ? segments.slice(1).join('/') : path;
}

function isIgnoredPath(path: string): boolean {
    const segments = path.split('/');
    if (segments.some((seg) => IGNORED_DIR_SEGMENTS.has(seg))) return true;
    const base = segments[segments.length - 1];
    return base === '.DS_Store' || base.startsWith('._');
}

function allowedExtension(path: string): boolean {
    const lower = path.toLowerCase();
    const dot = lower.lastIndexOf('.');
    if (dot < 0) return false;
    return SKILL_ALLOWED_EXTENSIONS.includes(lower.slice(dot));
}

export interface ExtractedZip {
    files: SkillFile[];
    skippedNonText: number;
    skippedIgnored: number;
    totalEntries: number;
}

/**
 * Smart zip filter: strips the codeload wrapper, applies the optional
 * subdir scope, skips dependency/vendor/binary clutter, and keeps only
 * Markdown/text files — with traceable caps (per-file, total, file count).
 */
export async function extractSkillZip(
    buffer: Buffer,
    opts: { subdir?: string | null; source?: string } = {},
): Promise<ExtractedZip> {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    const allEntries = Object.values(zip.files).filter((e) => !e.dir);
    const totalEntries = allEntries.length;
    if (totalEntries > SKILL_IMPORT_MAX_ZIP_ENTRIES) {
        throw new SkillImportSourceError(
            413,
            `Archive lists ${totalEntries} entries (scan cap ${SKILL_IMPORT_MAX_ZIP_ENTRIES}); narrow the import with a subdir or upload fewer files`,
            { total_entries: totalEntries, scan_cap: SKILL_IMPORT_MAX_ZIP_ENTRIES, source: opts.source?.slice(0, 1000) ?? null },
        );
    }
    const subdir = opts.subdir ? sanitizeSubdir(opts.subdir) : null;
    const prefix = subdir ? `${subdir}/` : null;

    // Detect a single shared top-level wrapper (codeload layout) and strip it
    // before matching the subdir scope.
    const firstSegments = allEntries.map((e) => e.name.replace(/\\/g, '/').split('/'));
    const sharedTop = firstSegments.length > 0 && firstSegments.every((segs) => segs.length > 1 && segs[0] === firstSegments[0][0])
        ? firstSegments[0][0]
        : null;

    const files: SkillFile[] = [];
    let skippedNonText = 0;
    let skippedIgnored = 0;
    let totalBytes = 0;

    for (const entry of allEntries) {
        let rel = entry.name.replace(/\\/g, '/').replace(/^\/+/, '');
        if (sharedTop && rel !== sharedTop && rel.startsWith(`${sharedTop}/`)) {
            rel = stripCodeloadPrefix(rel);
        }
        if (!rel || rel.endsWith('/')) continue;
        if (prefix && !(rel === subdir || rel.startsWith(prefix))) continue;
        const stored = prefix && rel.startsWith(prefix) ? rel.slice(prefix.length) : rel;
        if (!stored || stored.endsWith('/')) continue;
        if (isIgnoredPath(stored)) {
            skippedIgnored += 1;
            continue;
        }
        if (!allowedExtension(stored)) {
            skippedNonText += 1;
            continue;
        }
        const text = await entry.async('string');
        const bytes = Buffer.byteLength(text, 'utf8');
        if (bytes > SKILL_MAX_FILE_BYTES) {
            throw new SkillImportSourceError(
                413,
                `File exceeds ${SKILL_MAX_FILE_BYTES} bytes (found ${bytes}): ${stored.slice(0, 200)}`,
                { path: stored.slice(0, 500), actual_bytes: bytes, limit_bytes: SKILL_MAX_FILE_BYTES, source: opts.source?.slice(0, 1000) ?? null },
            );
        }
        totalBytes += bytes;
        if (totalBytes > SKILL_MAX_TOTAL_BYTES) {
            throw new SkillImportSourceError(
                413,
                `Archive exceeds ${SKILL_MAX_TOTAL_BYTES} bytes after filtering (file: ${stored.slice(0, 200)}); narrow the import with a subdir`,
                {
                    actual_bytes: totalBytes,
                    limit_bytes: SKILL_MAX_TOTAL_BYTES,
                    path: stored.slice(0, 500),
                    kept_files: files.length,
                    source: opts.source?.slice(0, 1000) ?? null,
                },
            );
        }
        files.push({ path: stored, content: text });
        if (files.length > SKILL_MAX_FILES) {
            throw new SkillImportSourceError(
                413,
                `Archive holds ${files.length}+ Markdown/text files (skill cap ${SKILL_MAX_FILES}); narrow the import with a subdir or split into smaller skills`,
                {
                    eligible_files: files.length,
                    limit_files: SKILL_MAX_FILES,
                    skipped_non_text: skippedNonText,
                    skipped_ignored: skippedIgnored,
                    source: opts.source?.slice(0, 1000) ?? null,
                },
            );
        }
    }
    return { files, skippedNonText, skippedIgnored, totalEntries };
}

/** Warning notice summarizing what the repo/archive filter dropped. */
export function repoFilterNotice(result: Pick<ExtractedZip, 'skippedNonText' | 'skippedIgnored'>, subdir: string | null): ImportNotice | null {
    const parts: string[] = [];
    if (result.skippedNonText > 0) parts.push(`${result.skippedNonText} non-text file(s) skipped (alpha imports Markdown/text only)`);
    if (result.skippedIgnored > 0) parts.push(`${result.skippedIgnored} vendor/ignored file(s) skipped`);
    if (parts.length === 0) return null;
    const scope = subdir ? ` within "${subdir}"` : '';
    return { code: 'repo_filtered', message: `Repo filter${scope}: ${parts.join('; ')}.` };
}
