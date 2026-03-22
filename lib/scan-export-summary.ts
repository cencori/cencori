import { sendChatRequest } from "@/lib/gemini";
import {
  ScanFinding,
  truncateFindings,
  countBySeverity,
} from "@/lib/scan-export-utils";

// Types
interface ScanMeta {
  repository: string; // e.g. "acme/frontend"
  scanDate: string; // ISO date string
}

const FALLBACK = "Summary unavailable.";
const NO_ISSUES = "No findings were identified in this scan.";

// ── Prompt builder ───────────────────────────────────────────────
// Exported so tests can verify the prompt content without calling Gemini
export function buildSummaryPrompt(
  findings: ScanFinding[],
  meta: ScanMeta,
): string {
  // Always truncate before building the prompt — max 20 findings
  const top = truncateFindings(findings, 20);
  const counts = countBySeverity(findings); // count from full list for accuracy

  const severityLine = [
    counts.critical && `${counts.critical} critical`,
    counts.high && `${counts.high} high`,
    counts.medium && `${counts.medium} medium`,
    counts.low && `${counts.low} low`,
  ]
    .filter(Boolean)
    .join(", ");

  const findingLines = top
    .map(
      (f) =>
        `- [${f.severity.toUpperCase()}] ${f.title}: ${f.description.slice(0, 100)}`,
    )
    .join("\n");

  return `
You are a security analyst writing an executive summary for a code scan report.
Write ONE paragraph (3-5 sentences) summarizing the scan results below.
Include: total issue count, severity breakdown, the most urgent finding, and the top recommendation.
Be specific and actionable. Do not use jargon.
 
Repository: ${meta.repository}
Scan date: ${meta.scanDate}
Total findings: ${findings.length} (${severityLine || "none"})
 
Top findings (up to 20 shown):
${findingLines || "None"}
 
Write only the summary paragraph. No headings, no bullet points.
`.trim();
}

// ── Main export ──────────────────────────────────────────────────
export async function generateExportSummary(
  findings: ScanFinding[],
  meta: ScanMeta,
): Promise<string> {
  // Zero-findings shortcut — no point calling Gemini
  if (findings.length === 0) return NO_ISSUES;

  try {
    const prompt = buildSummaryPrompt(findings, meta);

    const response = await sendChatRequest({
      messages: [{ role: "user", parts: [{ text: prompt }] }],
      model: "gemini-2.5-flash",
      temperature: 0.3,
      maxOutputTokens: 300, // ~3-5 sentences fits comfortably in 300 tokens
    });

    const summary = response.text?.trim();
    if (!summary) throw new Error("Empty response from Gemini");

    return summary;
  } catch (err) {
    // Log server-side but never surface internal errors to the user
    console.error("[scan-export-summary] Gemini call failed:", err);
    return FALLBACK;
  }
}
