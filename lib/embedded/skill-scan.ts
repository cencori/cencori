import crypto from 'crypto';

export interface SkillFile {
    path: string;
    content: string;
}

export interface ScanFinding {
    severity: 'blocker' | 'warning' | 'info';
    code: string;
    message: string;
    path?: string;
}

export const SKILL_MAX_FILES = 50;
export const SKILL_MAX_TOTAL_BYTES = 2 * 1024 * 1024;
export const SKILL_MAX_FILE_BYTES = 200 * 1024;
export const SKILL_ALLOWED_EXTENSIONS = ['.md', '.markdown', '.txt'];

const SECRET_PATTERNS: Array<{ code: string; re: RegExp }> = [
    { code: 'secret_aws_key', re: /AKIA[0-9A-Z]{16}/ },
    { code: 'secret_private_key', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
    { code: 'secret_token', re: /(?:api[_-]?key|secret|bearer)\s*[:=]\s*['"]?[A-Za-z0-9_\-.]{16,}['"]?/i },
    { code: 'secret_openai', re: /sk-(?:proj-)?[A-Za-z0-9]{16,}/ },
];

const INJECTION_PATTERNS: Array<{ code: string; re: RegExp }> = [
    { code: 'injection_ignore_instructions', re: /ignore\s+(all\s+)?(previous|prior)\s+instructions/i },
    { code: 'injection_role_override', re: /you\s+are\s+now\s+(a|an)\s+\w+/i },
    { code: 'injection_system_prompt', re: /reveal\s+(your\s+)?system\s+prompt|disregard.*safety|bypass.*(guardrail|filter)/i },
    { code: 'injection_exfiltrate', re: /exfiltrat|send\s+.*\s+to\s+external|POST\s+.*credentials/i },
];

const EXECUTABLE_EXTENSIONS = ['.sh', '.py', '.js', '.ts', '.exe', '.bin', '.so', '.dll', '.dylib', '.run'];

export function checksumSkillFiles(files: SkillFile[]): string {
    const canonical = [...files].sort((a, b) => a.path.localeCompare(b.path)).map((f) => `${f.path}\n${f.content}`).join('\n');
    return crypto.createHash('sha256').update(canonical).digest('hex');
}

export function normalizeSkillFiles(raw: Array<{ path?: string; content?: unknown }>): { files: SkillFile[]; findings: ScanFinding[] } {
    const findings: ScanFinding[] = [];
    const files: SkillFile[] = [];
    for (const entry of raw) {
        const path = (entry.path ?? 'SKILL.md').toString().replace(/\\/g, '/');
        if (path.includes('..') || path.startsWith('/')) {
            findings.push({ severity: 'blocker', code: 'path_traversal', message: `Rejected unsafe path: ${path}`, path });
            continue;
        }
        const lower = path.toLowerCase();
        const ext = lower.slice(lower.lastIndexOf('.'));
        if (EXECUTABLE_EXTENSIONS.includes(ext)) {
            findings.push({ severity: 'blocker', code: 'executable_content', message: `Executable files are not importable as skills in alpha: ${path}`, path });
            continue;
        }
        if (!SKILL_ALLOWED_EXTENSIONS.includes(ext)) {
            findings.push({ severity: 'warning', code: 'unsupported_format', message: `Skipped non-text file (alpha supports Markdown/text only): ${path}`, path });
            continue;
        }
        const content = typeof entry.content === 'string' ? entry.content : '';
        if (Buffer.byteLength(content, 'utf8') > SKILL_MAX_FILE_BYTES) {
            findings.push({ severity: 'blocker', code: 'file_too_large', message: `File exceeds ${SKILL_MAX_FILE_BYTES} bytes: ${path}`, path });
            continue;
        }
        files.push({ path, content });
    }
    return { files, findings };
}

/** Scan normalized files. Blockers prevent publication; warnings need review. */
export function scanSkillFiles(files: SkillFile[]): ScanFinding[] {
    const findings: ScanFinding[] = [];
    const totalBytes = files.reduce((n, f) => n + Buffer.byteLength(f.content, 'utf8'), 0);
    if (files.length > SKILL_MAX_FILES) {
        findings.push({ severity: 'blocker', code: 'too_many_files', message: `Skill exceeds ${SKILL_MAX_FILES} files` });
    }
    if (totalBytes > SKILL_MAX_TOTAL_BYTES) {
        findings.push({ severity: 'blocker', code: 'skill_too_large', message: `Skill exceeds ${SKILL_MAX_TOTAL_BYTES} bytes` });
    }
    for (const file of files) {
        // Binary detection: null bytes or mostly non-text.
        if (file.content.includes('\u0000')) {
            findings.push({ severity: 'blocker', code: 'binary_content', message: `Binary content is not importable: ${file.path}`, path: file.path });
            continue;
        }
        for (const { code, re } of SECRET_PATTERNS) {
            if (re.test(file.content)) {
                findings.push({ severity: 'blocker', code, message: `Possible embedded secret (${code}); remove before publishing`, path: file.path });
                break;
            }
        }
        for (const { code, re } of INJECTION_PATTERNS) {
            if (re.test(file.content)) {
                findings.push({ severity: 'blocker', code, message: `Possible prompt-injection pattern (${code}); review required`, path: file.path });
                break;
            }
        }
        const links = file.content.match(/https?:\/\/[^\s)>"']+/g) ?? [];
        if (links.length > 0) {
            findings.push({ severity: 'warning', code: 'external_links', message: `${links.length} external link(s) will be treated as untrusted text`, path: file.path });
        }
    }
    return findings;
}

export function hasBlockers(findings: ScanFinding[]): boolean {
    return findings.some((f) => f.severity === 'blocker');
}
