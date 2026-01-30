import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import {
    SECRET_PATTERNS,
    PII_PATTERNS,
    ROUTE_PATTERNS,
    VULNERABILITY_PATTERNS,
    IGNORE_PATTERNS,
    SCANNABLE_EXTENSIONS,
} from './patterns';

export type IssueType = 'secret' | 'pii' | 'route' | 'config' | 'vulnerability';
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ScanIssue {
    type: IssueType;
    category?: string;
    severity: IssueSeverity;
    name: string;
    provider?: string;
    file: string;
    line: number;
    column: number;
    match: string;
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
        vulnerabilities: number;
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
 * Check if file is a documentation or test file
 */
function isDocOrTestFile(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    return (
        lower.includes('.test.') ||
        lower.includes('.spec.') ||
        lower.includes('__tests__') ||
        lower.includes('/test/') ||
        lower.includes('/tests/') ||
        lower.endsWith('.md') ||
        lower.includes('/docs/')
    );
}

/**
 * Scan a single file for issues
 */
function scanFile(filePath: string, content: string): ScanIssue[] {
    const issues: ScanIssue[] = [];
    const relativePath = filePath;
    const isDocFile = isDocOrTestFile(filePath);

    // Scan for secrets
    for (const pattern of SECRET_PATTERNS) {
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

    // Scan for PII (skip in doc files)
    if (!isDocFile) {
        for (const pattern of PII_PATTERNS) {
            pattern.pattern.lastIndex = 0;
            let match;
            while ((match = pattern.pattern.exec(content)) !== null) {
                const matchStr = match[0];
                if (isLikelyFalsePositive(matchStr, pattern.name, filePath)) {
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

    // Scan for vulnerabilities (skip debug checks in test files)
    for (const pattern of VULNERABILITY_PATTERNS) {
        // Skip debug pattern checks in test/doc files
        if (pattern.category === 'debug' && isDocFile) {
            continue;
        }

        pattern.pattern.lastIndex = 0;
        let match;
        while ((match = pattern.pattern.exec(content)) !== null) {
            // Skip console.log false positives
            if (pattern.category === 'debug' && pattern.name === 'Console Log Statement') {
                // Allow console.error and console.warn
                if (match[0].includes('error') || match[0].includes('warn')) {
                    continue;
                }
            }

            const pos = getPosition(content, match.index);
            issues.push({
                type: 'vulnerability',
                category: pattern.category,
                severity: pattern.severity,
                name: pattern.name,
                file: relativePath,
                line: pos.line,
                column: pos.column,
                match: match[0].length > 50 ? match[0].slice(0, 50) + '...' : match[0],
                description: pattern.description,
            });
        }
    }

    // Check for .env files
    const fileName = path.basename(filePath);
    if (fileName.startsWith('.env') && !fileName.includes('.example')) {
        issues.push({
            type: 'config',
            severity: 'high',
            name: 'Environment file in repository',
            file: relativePath,
            line: 1,
            column: 1,
            match: fileName,
            description: 'Add .env* to .gitignore',
        });
    }

    return issues;
}

/**
 * Filter out likely false positives
 */
function isLikelyFalsePositive(match: string, patternName: string, filePath: string): boolean {
    // Email false positives
    if (patternName === 'Email Address') {
        const falseDomains = ['example.com', 'example.org', 'test.com', 'localhost', 'placeholder.com'];
        if (falseDomains.some(d => match.includes(d))) {
            return true;
        }

        const publicPrefixes = [
            'support@', 'help@', 'info@', 'contact@', 'sales@', 'admin@',
            'noreply@', 'no-reply@', 'hello@', 'team@', 'partners@',
            'enterprise@', 'security@', 'privacy@', 'legal@',
        ];
        if (publicPrefixes.some(p => match.toLowerCase().startsWith(p))) {
            return true;
        }
    }

    // IP address false positives
    if (patternName === 'IP Address') {
        const falseIPs = ['0.0.0.0', '127.0.0.1', '192.168.', '10.0.', '172.16.'];
        if (falseIPs.some(ip => match.startsWith(ip))) {
            return true;
        }
    }

    // Phone number false positives
    if (patternName.includes('Phone Number')) {
        if (match.includes('555') || match.includes('123-456') || match.includes('000-000')) {
            return true;
        }
    }

    return false;
}

/**
 * Calculate the security score
 */
function calculateScore(issues: ScanIssue[]): 'A' | 'B' | 'C' | 'D' | 'F' {
    const critical = issues.filter(i => i.severity === 'critical').length;
    const high = issues.filter(i => i.severity === 'high').length;
    const medium = issues.filter(i => i.severity === 'medium').length;

    if (critical > 0) return 'F';
    if (high >= 3) return 'F';
    if (high >= 2) return 'D';
    if (high >= 1 || medium >= 5) return 'C';
    if (medium >= 2) return 'B';
    if (issues.length === 0) return 'A';
    return 'B';
}

/**
 * Get tier description
 */
function getTierDescription(score: string): string {
    switch (score) {
        case 'A': return 'Excellent! No security issues detected.';
        case 'B': return 'Good, but minor improvements recommended.';
        case 'C': return 'Fair. Some security concerns need attention.';
        case 'D': return 'Poor. Significant security issues detected.';
        case 'F': return 'Critical! Major security vulnerabilities found.';
        default: return '';
    }
}

/**
 * Main scan function
 */
export async function scan(targetPath: string): Promise<ScanResult> {
    const startTime = Date.now();
    const absolutePath = path.resolve(targetPath);

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
            vulnerabilities: issues.filter(i => i.type === 'vulnerability').length,
            critical: issues.filter(i => i.severity === 'critical').length,
            high: issues.filter(i => i.severity === 'high').length,
            medium: issues.filter(i => i.severity === 'medium').length,
            low: issues.filter(i => i.severity === 'low').length,
        },
    };
}
