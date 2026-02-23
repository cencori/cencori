import { randomUUID } from "crypto";

export const GEMINI_SCAN_MODEL = "gemini-2.5-flash";
const GEMINI_FALLBACK_MODEL = "gemini-2.0-flash";
const MAX_JSON_PARSE_ATTEMPTS = 3;
const GEMINI_REQUEST_TIMEOUT_MS = 35_000;

export interface AiIssueInput {
    type: string;
    name: string;
    severity: string;
    file: string;
    line: number;
    match: string;
    description?: string;
}

export interface AiResearchInput {
    filesIndexed: number;
    interactionHotspots: Array<{ file: string; name: string; riskScore: number; reason: string }>;
    dataFlowTraces: Array<{ file: string; line: number; severity: string; summary: string }>;
}

export interface RepositoryAiInsight {
    id: string;
    model: string;
    generatedAt: string;
    summary: string;
    keyFindings: string[];
    remediationPlan: string[];
    prioritizedIssueKeys: string[];
}

export interface AiFileFixIssueInput {
    id: string;
    type: string;
    name: string;
    severity: string;
    line: number;
    match: string;
    description?: string;
    dataFlowContext?: string;
}

export interface AiFileFixIssueDecision {
    issueId: string;
    fixApplied: boolean;
    explanation: string;
}

export interface AiFileFixResult {
    model: string;
    updatedFileContent: string;
    issueDecisions: AiFileFixIssueDecision[];
    summary?: string;
}

function getGeminiApiKey(): string | null {
    return process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || null;
}

function tryParseJson<T>(value: string): T | null {
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
}

function extractJsonCandidates(text: string): string[] {
    const candidates: string[] = [];
    const trimmed = text.trim();
    if (trimmed.length === 0) {
        return candidates;
    }

    candidates.push(trimmed);

    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
        candidates.push(fencedMatch[1].trim());
    }

    const firstCurly = trimmed.indexOf("{");
    const firstSquare = trimmed.indexOf("[");
    const startIndices = [firstCurly, firstSquare]
        .filter((index) => index >= 0)
        .sort((a, b) => a - b);

    for (const startIndex of startIndices) {
        const opener = trimmed[startIndex];
        const closer = opener === "{" ? "}" : "]";
        let depth = 0;

        for (let index = startIndex; index < trimmed.length; index += 1) {
            const char = trimmed[index];
            if (char === opener) depth += 1;
            if (char === closer) depth -= 1;

            if (depth === 0) {
                const candidate = trimmed.slice(startIndex, index + 1).trim();
                if (candidate.length > 0) {
                    candidates.push(candidate);
                }
                break;
            }
        }
    }

    return Array.from(new Set(candidates));
}

function parseJsonFromModel<T>(text: string): T | null {
    const candidates = extractJsonCandidates(text);

    for (let attempt = 0; attempt < MAX_JSON_PARSE_ATTEMPTS; attempt += 1) {
        for (const candidate of candidates) {
            const parsed = tryParseJson<T>(candidate);
            if (parsed) {
                return parsed;
            }
        }
    }

    return null;
}

async function generateGeminiContent(prompt: string, preferredModel: string): Promise<{ model: string; text: string } | null> {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        return null;
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const models = [preferredModel, GEMINI_FALLBACK_MODEL];

    for (const modelName of models) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await Promise.race([
                model.generateContent(prompt),
                new Promise<never>((_, reject) =>
                    setTimeout(
                        () => reject(new Error(`Gemini request timed out after ${GEMINI_REQUEST_TIMEOUT_MS}ms`)),
                        GEMINI_REQUEST_TIMEOUT_MS
                    )
                ),
            ]);
            const text = result.response.text().trim();
            if (text) {
                return { model: modelName, text };
            }
        } catch (error) {
            console.error(`[Scan AI] Gemini request failed for model ${modelName}:`, error);
        }
    }

    return null;
}

function issueKey(issue: Pick<AiIssueInput, "file" | "line" | "type" | "name">): string {
    return `${issue.file}:${issue.line}:${issue.type}:${issue.name}`;
}

function sanitizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0);
}

export async function generateRepositoryAiInsight(input: {
    repository: string;
    issues: AiIssueInput[];
    research: AiResearchInput;
}): Promise<RepositoryAiInsight | null> {
    if (input.issues.length === 0) {
        return null;
    }

    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const issues = [...input.issues]
        .sort((a, b) => (priorityOrder[b.severity as keyof typeof priorityOrder] || 0) - (priorityOrder[a.severity as keyof typeof priorityOrder] || 0))
        .slice(0, 40);

    const prompt = `You are a senior security researcher.
Analyze this repository scan (regex + static graph/dataflow extraction) and produce concise triage guidance.

Repository: ${input.repository}
Files indexed: ${input.research.filesIndexed}

Top hotspots:
${JSON.stringify(input.research.interactionHotspots.slice(0, 8), null, 2)}

Top data flow traces:
${JSON.stringify(input.research.dataFlowTraces.slice(0, 12), null, 2)}

Issues (prioritized):
${JSON.stringify(
    issues.map((issue) => ({
        issueKey: issueKey(issue),
        severity: issue.severity,
        type: issue.type,
        name: issue.name,
        location: `${issue.file}:${issue.line}`,
        description: issue.description || null,
    })),
    null,
    2
)}

Return JSON only with this exact shape:
{
  "summary": "1-2 sentence executive summary",
  "keyFindings": ["short finding 1", "short finding 2"],
  "remediationPlan": ["step 1", "step 2", "step 3"],
  "prioritizedIssueKeys": ["file:line:type:name", "..."]
}

Rules:
- Keep findings actionable and code-centric.
- Prefer root-cause grouping (auth gaps, injection sinks, secret management, validation gaps).
- Do not include markdown fences.`;

    const response = await generateGeminiContent(prompt, GEMINI_SCAN_MODEL);
    if (!response) {
        return null;
    }

    const parsed = parseJsonFromModel<{
        summary?: unknown;
        keyFindings?: unknown;
        remediationPlan?: unknown;
        prioritizedIssueKeys?: unknown;
    }>(response.text);

    if (!parsed || typeof parsed.summary !== "string" || parsed.summary.trim().length === 0) {
        return null;
    }

    return {
        id: randomUUID(),
        model: response.model,
        generatedAt: new Date().toISOString(),
        summary: parsed.summary.trim(),
        keyFindings: sanitizeStringArray(parsed.keyFindings).slice(0, 8),
        remediationPlan: sanitizeStringArray(parsed.remediationPlan).slice(0, 8),
        prioritizedIssueKeys: sanitizeStringArray(parsed.prioritizedIssueKeys).slice(0, 16),
    };
}

export async function generateFileFixWithGemini(input: {
    repository: string;
    repositorySummary?: string;
    filePath: string;
    fileContent: string;
    issues: AiFileFixIssueInput[];
}): Promise<AiFileFixResult | null> {
    if (input.issues.length === 0) {
        return null;
    }

    // Keep payload bounded for model reliability.
    if (input.fileContent.length > 200_000) {
        return null;
    }

    const prompt = `You are a senior application security engineer.
Fix all safely-fixable issues in the provided file content.

Repository: ${input.repository}
File: ${input.filePath}
Repository risk summary: ${input.repositorySummary || "n/a"}

Issues:
${JSON.stringify(input.issues, null, 2)}

Current file content:
\`\`\`
${input.fileContent}
\`\`\`

Return JSON only in this exact shape:
{
  "updatedFileContent": "complete updated file content",
  "summary": "one sentence summary",
  "issueDecisions": [
    {
      "issueId": "issue id from input",
      "fixApplied": true,
      "explanation": "what was changed and why"
    }
  ]
}

Rules:
- Preserve behavior and avoid unrelated refactors.
- Fix security issues with minimal, safe edits.
- If an issue cannot be fixed confidently, set fixApplied=false and explain why.
- For secrets use environment variables (process.env.*).
- For injection vulnerabilities use parameterization/validation.
- For XSS use sanitization or safer rendering primitives.
- Do not include markdown fences or extra keys.`;

    const response = await generateGeminiContent(prompt, GEMINI_SCAN_MODEL);
    if (!response) {
        return null;
    }

    const parsed = parseJsonFromModel<{
        updatedFileContent?: unknown;
        summary?: unknown;
        issueDecisions?: unknown;
    }>(response.text);

    if (!parsed || typeof parsed.updatedFileContent !== "string") {
        return null;
    }

    const decisionsRaw = Array.isArray(parsed.issueDecisions) ? parsed.issueDecisions : [];
    const issueDecisions: AiFileFixIssueDecision[] = decisionsRaw
        .map((decision) => {
            const record = decision as Record<string, unknown>;
            const issueId = typeof record.issueId === "string" ? record.issueId : "";
            if (!issueId) {
                return null;
            }

            return {
                issueId,
                fixApplied: Boolean(record.fixApplied),
                explanation:
                    typeof record.explanation === "string" && record.explanation.trim().length > 0
                        ? record.explanation.trim()
                        : "AI did not provide a detailed explanation.",
            };
        })
        .filter((decision): decision is AiFileFixIssueDecision => Boolean(decision));

    return {
        model: response.model,
        updatedFileContent: parsed.updatedFileContent,
        issueDecisions,
        summary: typeof parsed.summary === "string" ? parsed.summary.trim() : undefined,
    };
}
