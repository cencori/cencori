import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import {
    SECRET_PATTERNS,
    PII_PATTERNS,
    ROUTE_PATTERNS,
    IGNORE_PATTERNS,
    SCANNABLE_EXTENSIONS,
    type SecretPattern,
    type PIIPattern,
    type RoutePattern,
} from './patterns';

export interface ScanIssue {
    type: 'secret' | 'pii' | 'route' | 'config';
    severity: 'critical' | 'high' | 'medium' | 'low';
    name: string;
    provider?: string;
    file: string;
    line: number;
    column: number;
    match: string; // Redacted version
    description?: string;
}

export interface ScanResult {
    score: 'A' | 'B' | 'C' | 'D' | 'F';
    tierDescription: string;
    issues: ScanIssue[];
    filesScanned: number;
    scanDuration: number;
    summary: {
        secrets: number;
        pii: number;
        routes: number;
        config: number;
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
}

/**
 * Redact sensitive content for display
 */
function redact(match: string, showChars: number = 4): string {
    if (match.length <= showChars * 2) {
        return '*'.repeat(match.length);
    }
    return match.slice(0, showChars) + '****' + match.slice(-showChars);
}

/**
 * Get line and column number for a match index
 */
function getPosition(content: string, index: number): { line: number; column: number } {
    const lines = content.slice(0, index).split('\n');
    return {
        line: lines.length,
        column: lines[lines.length - 1].length + 1,
    };
}

/**
 * Check if a file should be ignored
 */
function shouldIgnore(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    return IGNORE_PATTERNS.some(pattern => {
        if (pattern.startsWith('*')) {
            return normalized.endsWith(pattern.slice(1));
        }
        return normalized.includes(pattern);
    });
}

/**
 * Check if file has scannable extension
 */
function isScannable(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return SCANNABLE_EXTENSIONS.includes(ext);
}

/**
 * Scan a single file for issues
 */
function scanFile(filePath: string, content: string): ScanIssue[] {
    const issues: ScanIssue[] = [];
    const relativePath = filePath;

    // Scan for secrets
    for (const pattern of SECRET_PATTERNS) {
        // Reset regex lastIndex
        pattern.pattern.lastIndex = 0;
        let match;
        while ((match = pattern.pattern.exec(content)) !== null) {
            const pos = getPosition(content, match.index);
            issues.push({
                type: 'secret',
                severity: pattern.severity,
                name: pattern.name,
                provider: pattern.provider,
                file: relativePath,
                line: pos.line,
                column: pos.column,
                match: redact(match[0]),
            });
        }
    }

    // Scan for PII
    for (const pattern of PII_PATTERNS) {
        pattern.pattern.lastIndex = 0;
        let match;
        while ((match = pattern.pattern.exec(content)) !== null) {
            // Skip common false positives
            const matchStr = match[0];
            if (isLikelyFalsePositive(matchStr, pattern.name)) {
                continue;
            }

            const pos = getPosition(content, match.index);
            issues.push({
                type: 'pii',
                severity: pattern.severity,
                name: pattern.name,
                file: relativePath,
                line: pos.line,
                column: pos.column,
                match: redact(matchStr, 3),
            });
        }
    }

    // Scan for exposed routes
    for (const pattern of ROUTE_PATTERNS) {
        pattern.pattern.lastIndex = 0;
        let match;
        while ((match = pattern.pattern.exec(content)) !== null) {
            const pos = getPosition(content, match.index);
            issues.push({
                type: 'route',
                severity: pattern.severity,
                name: pattern.name,
                file: relativePath,
                line: pos.line,
                column: pos.column,
                match: match[0],
                description: pattern.description,
            });
        }
    }

    // Check for .env files in wrong places
    const fileName = path.basename(filePath);
    if (fileName.startsWith('.env') && !fileName.includes('.example')) {
        // If we're scanning a .env file, it might be committed
        const gitignorePath = path.join(path.dirname(filePath), '.gitignore');
        const gitignoreExists = fs.existsSync(gitignorePath);

        issues.push({
            type: 'config',
            severity: 'high',
            name: 'Environment file in repository',
            file: relativePath,
            line: 1,
            column: 1,
            match: fileName,
            description: gitignoreExists
                ? 'Verify this file is in .gitignore'
                : 'Add .env* to .gitignore',
        });
    }

    return issues;
}

/**
 * Filter out likely false positives
 */
function isLikelyFalsePositive(match: string, patternName: string): boolean {
    // Common email false positives
    if (patternName === 'Email Address') {
        const falseDomains = [
            'example.com',
            'example.org',
            'test.com',
            'localhost',
            'placeholder.com',
        ];
        if (falseDomains.some(d => match.includes(d))) {
            return true;
        }

        // Common public email prefixes (not personal PII)
        const publicPrefixes = [
            'support@',
            'help@',
            'info@',
            'contact@',
            'sales@',
            'admin@',
            'noreply@',
            'no-reply@',
            'hello@',
            'team@',
            'partners@',
            'enterprise@',
            'security@',
            'privacy@',
            'legal@',
        ];
        if (publicPrefixes.some(p => match.toLowerCase().startsWith(p))) {
            return true;
        }
    }

    // IP address false positives (version numbers, etc)
    if (patternName === 'IP Address') {
        const falseIPs = ['0.0.0.0', '127.0.0.1', '192.168.', '10.0.', '172.16.'];
        if (falseIPs.some(ip => match.startsWith(ip))) {
            return true;
        }
    }

    // Phone number false positives (example numbers in docs)
    if (patternName.includes('Phone Number')) {
        // Common example phone numbers
        if (match.includes('555') || match.includes('123-456') || match.includes('000-000')) {
            return true;
        }
    }

    return false;
}

/**
 * Calculate the fragility score based on issues
 */
function calculateScore(issues: ScanIssue[]): 'A' | 'B' | 'C' | 'D' | 'F' {
    const critical = issues.filter(i => i.severity === 'critical').length;
    const high = issues.filter(i => i.severity === 'high').length;
    const medium = issues.filter(i => i.severity === 'medium').length;
    const total = issues.length;

    // Scoring algorithm
    if (critical > 0) return 'F';
    if (high >= 3) return 'F';
    if (high >= 2) return 'D';
    if (high >= 1 || medium >= 5) return 'C';
    if (medium >= 2) return 'B';
    if (total === 0) return 'A';
    return 'B';
}

/**
 * Get tier description
 */
function getTierDescription(score: string): string {
    switch (score) {
        case 'A':
            return 'Excellent! No security issues detected.';
        case 'B':
            return 'Good, but minor improvements recommended.';
        case 'C':
            return 'Fair. Some security concerns need attention.';
        case 'D':
            return 'Poor. Significant security issues detected.';
        case 'F':
            return 'Critical! Your app is leaking secrets.';
        default:
            return '';
    }
}

/**
 * Main scan function
 */
export async function scan(targetPath: string): Promise<ScanResult> {
    const startTime = Date.now();
    const absolutePath = path.resolve(targetPath);

    // Get all files
    const files = await glob('**/*', {
        cwd: absolutePath,
        nodir: true,
        ignore: IGNORE_PATTERNS,
        absolute: true,
    });

    const issues: ScanIssue[] = [];
    let filesScanned = 0;

    for (const file of files) {
        if (!isScannable(file) || shouldIgnore(file)) {
            continue;
        }

        try {
            const content = fs.readFileSync(file, 'utf-8');
            const relativePath = path.relative(absolutePath, file);
            const fileIssues = scanFile(relativePath, content);
            issues.push(...fileIssues);
            filesScanned++;
        } catch {
            // Skip files that can't be read
            continue;
        }
    }

    const score = calculateScore(issues);
    const scanDuration = Date.now() - startTime;

    return {
        score,
        tierDescription: getTierDescription(score),
        issues,
        filesScanned,
        scanDuration,
        summary: {
            secrets: issues.filter(i => i.type === 'secret').length,
            pii: issues.filter(i => i.type === 'pii').length,
            routes: issues.filter(i => i.type === 'route').length,
            config: issues.filter(i => i.type === 'config').length,
            critical: issues.filter(i => i.severity === 'critical').length,
            high: issues.filter(i => i.severity === 'high').length,
            medium: issues.filter(i => i.severity === 'medium').length,
            low: issues.filter(i => i.severity === 'low').length,
        },
    };
}
