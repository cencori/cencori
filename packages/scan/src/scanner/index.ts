import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { IGNORE_PATTERNS } from './patterns';
import {
    calculateScore,
    getTierDescription,
    scanFileContent,
    shouldScanFile,
    summarizeIssues,
    type ScanIssue,
    type ScanScore,
    type ScanSummary,
} from './core';

export type { IssueType, IssueSeverity, ScanIssue, ScanScore, ScanSummary } from './core';

export interface ScanResult {
    score: ScanScore;
    tierDescription: string;
    issues: ScanIssue[];
    filesScanned: number;
    scanDuration: number;
    summary: ScanSummary;
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
        const relativePath = path.relative(absolutePath, file);
        if (!shouldScanFile(relativePath)) continue;
        try {
            const content = fs.readFileSync(file, 'utf-8');
            const fileIssues = scanFileContent(relativePath, content);
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
        summary: summarizeIssues(issues),
    };
}
