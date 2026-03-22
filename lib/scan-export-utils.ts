// Types
export interface ScanFinding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  file: string;
  line: number | null;
  description: string;
  recommendation: string;
}

export interface ScanResult {
  id: string;
  projectId: string;
  scanDate: string;
  repository: string;
  findings: ScanFinding[];
}

// ── CSV Helpers ──────────────────────────────────────────────────

// Escape a single CSV field value:
// - Wraps the value in double quotes if it contains commas, quotes, or newlines
// - Doubles any existing double quotes inside the value (standard CSV escaping)
export function escapeCsvField(value: string | number | null): string {
  const str = String(value ?? "");
  // If the string contains comma, double-quote, or newline — it must be quoted
  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Build one CSV row from a single finding
export function buildCsvRow(finding: ScanFinding): string {
  return [
    escapeCsvField(finding.severity),
    escapeCsvField(finding.title),
    escapeCsvField(finding.file),
    escapeCsvField(finding.line),
    escapeCsvField(finding.description),
    escapeCsvField(finding.recommendation),
  ].join(",");
}

// Build the complete CSV string from an array of findings
export function buildCsvExport(findings: ScanFinding[]): string {
  const header = "severity,title,file,line,description,recommendation";
  const rows = findings.map(buildCsvRow);
  return [header, ...rows].join("\n");
}

// ── JSON Helper ──────────────────────────────────────────────────

// Returns a pretty-printed JSON string of the full scan result
export function buildJsonExport(scanResult: ScanResult): string {
  return JSON.stringify(scanResult, null, 2);
}

// ── Credential Redaction ─────────────────────────────────────────

// Pattern: matches strings of 32+ alphanumeric/dash/underscore characters
// This catches most API keys, tokens, and secrets
const CREDENTIAL_PATTERN = /[A-Za-z0-9_\-]{32,}/g;

// Redact credential-like values from a single string
export function redactCredentials(text: string): string {
  return text.replace(CREDENTIAL_PATTERN, "[REDACTED]");
}

// Apply redaction to the description and recommendation fields of every finding
// Does NOT touch severity, title, file, or line — only free-text fields
export function redactFindingsForExport(
  findings: ScanFinding[],
): ScanFinding[] {
  return findings.map((f) => ({
    ...f,
    description: redactCredentials(f.description),
    recommendation: redactCredentials(f.recommendation),
  }));
}

// ── Truncation ───────────────────────────────────────────────────

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

// Sort by severity and return the top N findings
// Used before sending to Gemini to avoid exceeding token limits
export function truncateFindings(
  findings: ScanFinding[],
  max = 20,
): ScanFinding[] {
  return [...findings]
    .sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity] ?? 5) - (SEVERITY_ORDER[b.severity] ?? 5),
    )
    .slice(0, max);
}

// ── Severity Counter ─────────────────────────────────────────────

// Count findings by severity level — used in the AI summary prompt
export function countBySeverity(
  findings: ScanFinding[],
): Record<string, number> {
  return findings.reduce(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
}
