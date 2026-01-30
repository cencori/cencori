import { NextRequest, NextResponse } from "next/server";

// Scanner patterns (ported from @cencori/scan CLI)
const SECRET_PATTERNS = [
    { name: "OpenAI API Key", pattern: /sk-[a-zA-Z0-9]{20,}(?:T3BlbkFJ[a-zA-Z0-9]{20,})?/g, severity: "critical" as const },
    { name: "OpenAI Project Key", pattern: /sk-proj-[a-zA-Z0-9_-]{80,}/g, severity: "critical" as const },
    { name: "Anthropic API Key", pattern: /sk-ant-[a-zA-Z0-9_-]{40,}/g, severity: "critical" as const },
    { name: "Google AI Key", pattern: /AIza[0-9A-Za-z_-]{35}/g, severity: "critical" as const },
    { name: "Supabase Service Key", pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, severity: "critical" as const },
    { name: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/g, severity: "critical" as const },
    { name: "GitHub Token", pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g, severity: "critical" as const },
    { name: "Stripe Secret Key", pattern: /sk_(live|test)_[0-9a-zA-Z]{24,}/g, severity: "critical" as const },
    { name: "Discord Bot Token", pattern: /[MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27}/g, severity: "high" as const },
    { name: "Slack Token", pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/g, severity: "high" as const },
    { name: "Private Key", pattern: /-----BEGIN (?:RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/g, severity: "critical" as const },
    { name: "Generic API Key", pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_-]{20,}['"]/gi, severity: "medium" as const },
    { name: "Generic Secret", pattern: /(?:secret|password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi, severity: "high" as const },
];

const PII_PATTERNS = [
    { name: "Email Address", pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, severity: "low" as const },
    { name: "Phone Number", pattern: /(?:\+1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g, severity: "medium" as const },
    { name: "SSN", pattern: /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/g, severity: "critical" as const },
    { name: "Credit Card", pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g, severity: "critical" as const },
];

const VULNERABILITY_PATTERNS = [
    { name: "SQL Injection", pattern: /(?:SELECT|INSERT|UPDATE|DELETE|DROP).+\$\{[^}]+\}/gi, severity: "high" as const },
    { name: "XSS (innerHTML)", pattern: /\.innerHTML\s*=/g, severity: "medium" as const },
    { name: "XSS (dangerouslySetInnerHTML)", pattern: /dangerouslySetInnerHTML/g, severity: "medium" as const },
    { name: "Insecure CORS", pattern: /Access-Control-Allow-Origin['":\s]+\*/g, severity: "medium" as const },
    { name: "Hardcoded Password", pattern: /password\s*[:=]\s*['"][^'"]{4,}['"]/gi, severity: "high" as const },
    { name: "Debug Mode", pattern: /(?:DEBUG|debug)\s*[:=]\s*(?:true|1|'true'|"true")/g, severity: "low" as const },
    { name: "eval() Usage", pattern: /\beval\s*\(/g, severity: "high" as const },
];

interface ScanIssue {
    type: string;
    severity: string;
    name: string;
    match: string;
    line: number;
    description?: string;
}

interface ScanResult {
    score: "A" | "B" | "C" | "D" | "F";
    tierDescription: string;
    issues: ScanIssue[];
    filesScanned: number;
    scanDuration: number;
    summary: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
}

function redact(match: string, showChars = 4): string {
    if (match.length <= showChars * 2) return "****";
    return match.substring(0, showChars) + "****";
}

function getLine(content: string, index: number): number {
    return content.substring(0, index).split("\n").length;
}

function scanCode(code: string): ScanIssue[] {
    const issues: ScanIssue[] = [];

    // Scan for secrets
    for (const pattern of SECRET_PATTERNS) {
        pattern.pattern.lastIndex = 0;
        let match;
        while ((match = pattern.pattern.exec(code)) !== null) {
            issues.push({
                type: "secret",
                severity: pattern.severity,
                name: pattern.name,
                match: redact(match[0]),
                line: getLine(code, match.index),
            });
        }
    }

    // Scan for PII
    for (const pattern of PII_PATTERNS) {
        pattern.pattern.lastIndex = 0;
        let match;
        while ((match = pattern.pattern.exec(code)) !== null) {
            issues.push({
                type: "pii",
                severity: pattern.severity,
                name: pattern.name,
                match: redact(match[0]),
                line: getLine(code, match.index),
            });
        }
    }

    // Scan for vulnerabilities
    for (const pattern of VULNERABILITY_PATTERNS) {
        pattern.pattern.lastIndex = 0;
        let match;
        while ((match = pattern.pattern.exec(code)) !== null) {
            issues.push({
                type: "vulnerability",
                severity: pattern.severity,
                name: pattern.name,
                match: match[0].substring(0, 50),
                line: getLine(code, match.index),
            });
        }
    }

    return issues;
}

function calculateScore(issues: ScanIssue[]): "A" | "B" | "C" | "D" | "F" {
    const critical = issues.filter((i) => i.severity === "critical").length;
    const high = issues.filter((i) => i.severity === "high").length;
    const medium = issues.filter((i) => i.severity === "medium").length;

    if (critical > 0) return "F";
    if (high > 2) return "D";
    if (high > 0 || medium > 3) return "C";
    if (medium > 0) return "B";
    return "A";
}

function getTierDescription(score: string): string {
    switch (score) {
        case "A": return "Excellent! No significant security issues detected.";
        case "B": return "Good! Minor improvements recommended.";
        case "C": return "Fair. Some security concerns need attention.";
        case "D": return "Poor. Significant security issues found.";
        case "F": return "Critical! Serious security vulnerabilities detected.";
        default: return "";
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { code } = body;

        if (!code || typeof code !== "string") {
            return NextResponse.json(
                { error: "Code is required" },
                { status: 400 }
            );
        }

        // Limit code size
        if (code.length > 100000) {
            return NextResponse.json(
                { error: "Code too large (max 100KB)" },
                { status: 400 }
            );
        }

        const startTime = Date.now();
        const issues = scanCode(code);
        const scanDuration = Date.now() - startTime;

        const score = calculateScore(issues);

        const result: ScanResult = {
            score,
            tierDescription: getTierDescription(score),
            issues,
            filesScanned: 1,
            scanDuration,
            summary: {
                critical: issues.filter((i) => i.severity === "critical").length,
                high: issues.filter((i) => i.severity === "high").length,
                medium: issues.filter((i) => i.severity === "medium").length,
                low: issues.filter((i) => i.severity === "low").length,
            },
        };

        return NextResponse.json(result);
    } catch {
        return NextResponse.json(
            { error: "Scan failed" },
            { status: 500 }
        );
    }
}
