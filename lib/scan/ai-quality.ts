import path from "path";
import type { IssueSeverity, ScanIssue } from "@/packages/scan/src/scanner/core";
import { generateWithFallback } from "./ai-client";

const MAX_PROMPT_FILES = 8;
const MAX_FILE_CHARS = 16_000;
const MAX_AI_ISSUES = 40;

const QUALITY_CATEGORIES = new Set([
    "maintainability",
    "reliability",
    "type-safety",
    "complexity",
] as const);

type QualityCategory = "maintainability" | "reliability" | "type-safety" | "complexity";

const QUALITY_FILE_EXTENSIONS = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".py",
    ".go",
    ".java",
    ".rb",
    ".php",
    ".svelte",
    ".vue",
]);

interface ScannedFileInput {
    path: string;
    content: string;
}

interface AiIssueCandidate {
    file?: string;
    line?: number;
    severity?: string;
    category?: string;
    name?: string;
    match?: string;
    description?: string;
}

interface AiQualityResponse {
    issues?: AiIssueCandidate[];
}

export interface AiCodeQualityResult {
    issues: ScanIssue[];
    evaluatedFiles: number;
    provider?: string;
    model?: string;
    warning?: string;
}

function hasAiProviderConfigured(): boolean {
    return Boolean(
        process.env.CEREBRAS_API_KEY ||
        process.env.GROQ_API_KEY ||
        process.env.GOOGLE_AI_API_KEY ||
        process.env.GEMINI_API_KEY
    );
}

function isLikelyBinary(content: string): boolean {
    return /[\u0000-\u0008\u000E-\u001A]/.test(content);
}

function isCodeFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return QUALITY_FILE_EXTENSIONS.has(ext);
}

function issueKey(issue: Pick<ScanIssue, "file" | "line" | "type" | "name">): string {
    return `${issue.file}:${issue.line}:${issue.type}:${issue.name}`;
}

function tryParseJson<T>(text: string): T | null {
    try {
        return JSON.parse(text) as T;
    } catch {
        // continue
    }

    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
        try {
            return JSON.parse(fenced[1].trim()) as T;
        } catch {
            // continue
        }
    }

    const firstBrace = text.indexOf("{");
    if (firstBrace >= 0) {
        try {
            return JSON.parse(text.slice(firstBrace)) as T;
        } catch {
            // continue
        }
    }

    return null;
}

function shortText(value: string, maxLength: number): string {
    const normalized = value.trim();
    if (!normalized) return "";
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function getLineAt(content: string, line: number): string {
    const lines = content.split("\n");
    if (line < 1 || line > lines.length) return "";
    return lines[line - 1] || "";
}

function countIssueByFile(existingIssues: ScanIssue[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const issue of existingIssues) {
        counts.set(issue.file, (counts.get(issue.file) ?? 0) + 1);
    }
    return counts;
}

function selectFilesForPrompt(scannedFiles: ScannedFileInput[], existingIssues: ScanIssue[]): ScannedFileInput[] {
    const issueCount = countIssueByFile(existingIssues);
    return scannedFiles
        .filter((file) => isCodeFile(file.path))
        .filter((file) => file.content && !isLikelyBinary(file.content))
        .map((file) => ({
            ...file,
            score: (issueCount.get(file.path) ?? 0) * 100 + Math.min(file.content.length, 30_000) / 300,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_PROMPT_FILES)
        .map(({ path: filePath, content }) => ({
            path: filePath,
            content: content.length > MAX_FILE_CHARS
                ? `${content.slice(0, MAX_FILE_CHARS)}\n// [truncated for AI quality review]`
                : content,
        }));
}

function normalizeSeverity(value: unknown): IssueSeverity {
    const raw = typeof value === "string" ? value.toLowerCase() : "";
    return raw === "medium" ? "medium" : "low";
}

function normalizeCategory(value: unknown): QualityCategory {
    const raw = typeof value === "string" ? value.toLowerCase() : "";
    if (QUALITY_CATEGORIES.has(raw as QualityCategory)) {
        return raw as QualityCategory;
    }
    return "maintainability";
}

function buildPrompt(
    repository: string,
    filesForPrompt: Array<{ path: string; content: string }>,
    existingIssues: ScanIssue[]
): string {
    const contextIssues = existingIssues
        .filter((issue) => issue.type !== "dependency")
        .slice(0, 120)
        .map((issue) => ({
            type: issue.type,
            severity: issue.severity,
            file: issue.file,
            line: issue.line,
            name: issue.name,
        }));

    return `You are a senior software engineer performing a code-quality review.
Focus on maintainability, reliability, type-safety, and complexity issues.

Repository: ${repository}

Existing findings (for context):
${JSON.stringify(contextIssues, null, 2)}

Files to review:
${JSON.stringify(filesForPrompt, null, 2)}

Return JSON only with this shape:
{
  "issues": [
    {
      "file": "path/to/file.ts",
      "line": 12,
      "severity": "low|medium",
      "category": "maintainability|reliability|type-safety|complexity",
      "name": "Short issue title",
      "match": "short code fragment",
      "description": "One sentence with concrete why/fix direction"
    }
  ]
}

Rules:
- Only return high-confidence code quality findings.
- Do not return style-only nits (quote style, semicolons, whitespace).
- Do not return security issues already represented by secret/injection categories.
- Prefer fewer, higher-signal findings.
- Max 40 issues.`;
}

function normalizeAiIssues(
    rawIssues: AiIssueCandidate[],
    availableFiles: Map<string, string>,
    existingIssues: ScanIssue[]
): ScanIssue[] {
    const normalized: ScanIssue[] = [];
    const seen = new Set<string>();
    const existingKeys = new Set(existingIssues.map(issueKey));

    for (const raw of rawIssues.slice(0, MAX_AI_ISSUES)) {
        const filePath = typeof raw.file === "string" ? raw.file.trim() : "";
        if (!filePath || !availableFiles.has(filePath)) {
            continue;
        }

        const fileContent = availableFiles.get(filePath) || "";
        const lines = fileContent.split("\n");
        const lineRaw = typeof raw.line === "number" && Number.isFinite(raw.line) ? Math.floor(raw.line) : 1;
        const line = Math.max(1, Math.min(lineRaw, Math.max(lines.length, 1)));
        const lineMatch = shortText(
            typeof raw.match === "string" && raw.match.trim().length > 0
                ? raw.match
                : getLineAt(fileContent, line),
            120
        );
        const name = shortText(
            typeof raw.name === "string" && raw.name.trim().length > 0
                ? raw.name
                : "AI Code Quality Finding",
            90
        );
        const description = shortText(
            typeof raw.description === "string" && raw.description.trim().length > 0
                ? raw.description
                : "AI flagged this code path for maintainability or reliability improvement.",
            280
        );

        const issue: ScanIssue = {
            type: "code_quality",
            category: normalizeCategory(raw.category),
            severity: normalizeSeverity(raw.severity),
            name,
            file: filePath,
            line,
            column: 1,
            match: lineMatch || name,
            description,
            confidence: "high",
        };

        const key = issueKey(issue);
        if (seen.has(key) || existingKeys.has(key)) {
            continue;
        }
        seen.add(key);
        normalized.push(issue);
    }

    return normalized;
}

export async function generateAiCodeQualityIssues(input: {
    repository: string;
    scannedFiles: ScannedFileInput[];
    existingIssues: ScanIssue[];
}): Promise<AiCodeQualityResult> {
    if (!hasAiProviderConfigured()) {
        return {
            issues: [],
            evaluatedFiles: 0,
            warning: "AI code-quality review skipped (no AI provider keys configured).",
        };
    }

    const filesForPrompt = selectFilesForPrompt(input.scannedFiles, input.existingIssues);
    if (filesForPrompt.length === 0) {
        return {
            issues: [],
            evaluatedFiles: 0,
            warning: "AI code-quality review skipped (no eligible source files).",
        };
    }

    const prompt = buildPrompt(input.repository, filesForPrompt, input.existingIssues);
    const ai = await generateWithFallback(prompt);
    if (!ai?.text) {
        return {
            issues: [],
            evaluatedFiles: filesForPrompt.length,
            warning: "AI code-quality review unavailable. Continuing with rule-based findings.",
        };
    }

    const parsed = tryParseJson<AiQualityResponse>(ai.text);
    if (!parsed || !Array.isArray(parsed.issues)) {
        return {
            issues: [],
            evaluatedFiles: filesForPrompt.length,
            provider: ai.provider,
            model: ai.model,
            warning: "AI code-quality review returned an invalid format. Continuing with rule-based findings.",
        };
    }

    const availableFiles = new Map(filesForPrompt.map((file) => [file.path, file.content]));
    const issues = normalizeAiIssues(parsed.issues, availableFiles, input.existingIssues);
    return {
        issues,
        evaluatedFiles: filesForPrompt.length,
        provider: ai.provider,
        model: ai.model,
    };
}
