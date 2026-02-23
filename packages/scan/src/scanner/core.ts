import * as path from 'path';
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
export type ScanScore = 'A' | 'B' | 'C' | 'D' | 'F';

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

export interface ScanSummary {
    secrets: number;
    pii: number;
    routes: number;
    config: number;
    vulnerabilities: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
}

function redact(match: string, showChars: number = 4): string {
    if (match.length <= showChars * 2) {
        return '*'.repeat(match.length);
    }
    return match.slice(0, showChars) + '****' + match.slice(-showChars);
}

function getPosition(content: string, index: number): { line: number; column: number } {
    const lines = content.slice(0, index).split('\n');
    return {
        line: lines.length,
        column: lines[lines.length - 1].length + 1,
    };
}

export function shouldIgnore(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    return IGNORE_PATTERNS.some(pattern => {
        if (pattern.startsWith('*')) {
            return normalized.endsWith(pattern.slice(1));
        }
        return normalized.includes(pattern);
    });
}

export function isScannable(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return SCANNABLE_EXTENSIONS.includes(ext);
}

export function shouldScanFile(filePath: string): boolean {
    return isScannable(filePath) && !shouldIgnore(filePath);
}

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

function isLikelyFalsePositive(match: string, patternName: string): boolean {
    if (patternName === 'Email Address') {
        const falseDomains = ['example.com', 'example.org', 'test.com', 'localhost', 'placeholder.com'];
        if (falseDomains.some(domain => match.includes(domain))) {
            return true;
        }

        const publicPrefixes = [
            'support@', 'help@', 'info@', 'contact@', 'sales@', 'admin@',
            'noreply@', 'no-reply@', 'hello@', 'team@', 'partners@',
            'enterprise@', 'security@', 'privacy@', 'legal@',
        ];
        if (publicPrefixes.some(prefix => match.toLowerCase().startsWith(prefix))) {
            return true;
        }
    }

    if (patternName === 'IP Address') {
        const falseIPs = ['0.0.0.0', '127.0.0.1', '192.168.', '10.0.', '172.16.'];
        if (falseIPs.some(ip => match.startsWith(ip))) {
            return true;
        }
    }

    if (patternName.includes('Phone Number')) {
        if (match.includes('555') || match.includes('123-456') || match.includes('000-000')) {
            return true;
        }
    }

    return false;
}

function detectExposedRouteFromPath(filePath: string): { framework: string; route: string } | null {
    const normalized = filePath.replace(/\\/g, '/');

    const appRouteMatch = normalized.match(/^app\/api(?:\/(.+))?\/route\.(?:[cm]?[jt]sx?)$/i);
    if (appRouteMatch) {
        const route = `/api/${appRouteMatch[1] || ''}`
            .replace(/\/index$/i, '')
            .replace(/\/+/g, '/');
        return { framework: 'Next.js', route };
    }

    const pagesRouteMatch = normalized.match(/^pages\/api\/(.+)\.(?:[cm]?[jt]sx?)$/i);
    if (pagesRouteMatch?.[1]) {
        const route = `/api/${pagesRouteMatch[1]}`
            .replace(/\/index$/i, '')
            .replace(/\/+/g, '/');
        return { framework: 'Next.js', route };
    }

    const expressRouteMatch = normalized.match(/(?:^|\/)routes\/(.+)\.(?:[cm]?[jt]sx?|py|rb|php|go|java)$/i);
    if (expressRouteMatch?.[1]) {
        const route = `/${expressRouteMatch[1]}`
            .replace(/\/index$/i, '')
            .replace(/\/+/g, '/');
        return { framework: 'Express/Generic', route };
    }

    return null;
}

export function scanFileContent(filePath: string, content: string): ScanIssue[] {
    const issues: ScanIssue[] = [];
    const isDocFile = isDocOrTestFile(filePath);

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
                file: filePath,
                line: pos.line,
                column: pos.column,
                match: redact(match[0]),
            });
        }
    }

    if (!isDocFile) {
        for (const pattern of PII_PATTERNS) {
            pattern.pattern.lastIndex = 0;
            let match;
            while ((match = pattern.pattern.exec(content)) !== null) {
                const matchStr = match[0];
                if (isLikelyFalsePositive(matchStr, pattern.name)) {
                    continue;
                }

                const pos = getPosition(content, match.index);
                issues.push({
                    type: 'pii',
                    severity: pattern.severity,
                    name: pattern.name,
                    file: filePath,
                    line: pos.line,
                    column: pos.column,
                    match: redact(matchStr, 3),
                });
            }
        }
    }

    for (const pattern of ROUTE_PATTERNS) {
        pattern.pattern.lastIndex = 0;
        let match;
        while ((match = pattern.pattern.exec(content)) !== null) {
            const pos = getPosition(content, match.index);
            issues.push({
                type: 'route',
                severity: pattern.severity,
                name: pattern.name,
                file: filePath,
                line: pos.line,
                column: pos.column,
                match: match[0],
                description: pattern.description,
            });
        }
    }

    const exposedRoute = detectExposedRouteFromPath(filePath);
    if (exposedRoute) {
        issues.push({
            type: 'route',
            severity: 'low',
            name: 'Exposed API Route File',
            file: filePath,
            line: 1,
            column: 1,
            match: exposedRoute.route,
            description: `${exposedRoute.framework} route detected. Verify authentication, authorization, and request validation.`,
        });
    }

    for (const pattern of VULNERABILITY_PATTERNS) {
        if (pattern.category === 'debug' && isDocFile) {
            continue;
        }

        pattern.pattern.lastIndex = 0;
        let match;
        while ((match = pattern.pattern.exec(content)) !== null) {
            if (pattern.category === 'debug' && pattern.name === 'Console Log Statement') {
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
                file: filePath,
                line: pos.line,
                column: pos.column,
                match: match[0].length > 50 ? match[0].slice(0, 50) + '...' : match[0],
                description: pattern.description,
            });
        }
    }

    const fileName = path.basename(filePath);
    if (fileName.startsWith('.env') && !fileName.includes('.example')) {
        issues.push({
            type: 'config',
            severity: 'high',
            name: 'Environment file in repository',
            file: filePath,
            line: 1,
            column: 1,
            match: fileName,
            description: 'Add .env* to .gitignore',
        });
    }

    return issues;
}

export function calculateScore(issues: ScanIssue[]): ScanScore {
    const critical = issues.filter(issue => issue.severity === 'critical').length;
    const high = issues.filter(issue => issue.severity === 'high').length;
    const medium = issues.filter(issue => issue.severity === 'medium').length;

    if (critical > 0) return 'F';
    if (high >= 3) return 'F';
    if (high >= 2) return 'D';
    if (high >= 1 || medium >= 5) return 'C';
    if (medium >= 2) return 'B';
    if (issues.length === 0) return 'A';
    return 'B';
}

export function getTierDescription(score: ScanScore): string {
    switch (score) {
        case 'A': return 'Excellent! No security issues detected.';
        case 'B': return 'Good, but minor improvements recommended.';
        case 'C': return 'Fair. Some security concerns need attention.';
        case 'D': return 'Poor. Significant security issues detected.';
        case 'F': return 'Critical! Major security vulnerabilities found.';
    }
}

export function summarizeIssues(issues: ScanIssue[]): ScanSummary {
    return {
        secrets: issues.filter(issue => issue.type === 'secret').length,
        pii: issues.filter(issue => issue.type === 'pii').length,
        routes: issues.filter(issue => issue.type === 'route').length,
        config: issues.filter(issue => issue.type === 'config').length,
        vulnerabilities: issues.filter(issue => issue.type === 'vulnerability').length,
        critical: issues.filter(issue => issue.severity === 'critical').length,
        high: issues.filter(issue => issue.severity === 'high').length,
        medium: issues.filter(issue => issue.severity === 'medium').length,
        low: issues.filter(issue => issue.severity === 'low').length,
    };
}
