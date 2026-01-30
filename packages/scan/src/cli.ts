#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { scan, type ScanResult, type ScanIssue } from './scanner/index.js';

const VERSION = '0.2.0';

// Score colors
const scoreStyles: Record<string, { color: typeof chalk.green }> = {
    A: { color: chalk.green },
    B: { color: chalk.blue },
    C: { color: chalk.yellow },
    D: { color: chalk.red },
    F: { color: chalk.bgRed.white },
};

const severityColors: Record<string, typeof chalk.red> = {
    critical: chalk.bgRed.white,
    high: chalk.red,
    medium: chalk.yellow,
    low: chalk.blue,
};

const typeLabels: Record<string, string> = {
    secret: 'SECRETS',
    pii: 'PII',
    route: 'ROUTES',
    config: 'CONFIG',
    vulnerability: 'VULNERABILITIES',
};

/**
 * Print the banner
 */
function printBanner(): void {
    console.log();
    console.log(chalk.cyan.bold('  Cencori Scan'));
    console.log(chalk.gray(`  v${VERSION}`));
    console.log();
}

/**
 * Print the score box
 */
function printScore(result: ScanResult): void {
    const style = scoreStyles[result.score];
    const scoreText = `${result.score}-Tier`;
    const content = `   Security Score: ${scoreText}`;

    console.log();
    console.log(chalk.gray('  ┌─────────────────────────────────────────────┐'));
    console.log(chalk.gray('  │') + style.color.bold(content.padEnd(45)) + chalk.gray('│'));
    console.log(chalk.gray('  └─────────────────────────────────────────────┘'));
    console.log();
    console.log(chalk.gray(`  ${result.tierDescription}`));
    console.log();
}

/**
 * Print issues grouped by type
 */
function printIssues(issues: ScanIssue[]): void {
    if (issues.length === 0) {
        console.log(chalk.green('  No security issues found.'));
        console.log();
        return;
    }

    // Group by type
    const grouped: Record<string, ScanIssue[]> = {};
    for (const issue of issues) {
        if (!grouped[issue.type]) {
            grouped[issue.type] = [];
        }
        grouped[issue.type].push(issue);
    }

    // Print each group
    for (const [type, typeIssues] of Object.entries(grouped)) {
        const label = typeLabels[type] || type.toUpperCase();

        console.log(`  ${chalk.bold(label)} (${typeIssues.length})`);

        for (let i = 0; i < typeIssues.length; i++) {
            const issue = typeIssues[i];
            const isLast = i === typeIssues.length - 1;
            const prefix = isLast ? '  └─' : '  ├─';
            const severityColor = severityColors[issue.severity];

            console.log(
                chalk.gray(prefix) + ' ' +
                chalk.gray(`${issue.file}:${issue.line}`) + '  ' +
                severityColor(issue.match)
            );

            if (issue.description) {
                const descPrefix = isLast ? '     ' : '  │  ';
                console.log(chalk.gray(descPrefix) + chalk.dim(issue.description));
            }
        }
        console.log();
    }
}

/**
 * Print summary stats
 */
function printSummary(result: ScanResult): void {
    const { summary } = result;

    console.log(chalk.gray('  ─────────────────────────────────────────────'));
    console.log();
    console.log(`  ${chalk.bold('Summary')}`);
    console.log(`    Files scanned: ${chalk.cyan(result.filesScanned)}`);
    console.log(`    Scan time: ${chalk.cyan(result.scanDuration + 'ms')}`);
    console.log();

    if (summary.critical > 0) {
        console.log(`    ${chalk.bgRed.white(' CRITICAL ')} ${summary.critical} issues`);
    }
    if (summary.high > 0) {
        console.log(`    ${chalk.red('   HIGH   ')} ${summary.high} issues`);
    }
    if (summary.medium > 0) {
        console.log(`    ${chalk.yellow(' MEDIUM  ')} ${summary.medium} issues`);
    }
    if (summary.low > 0) {
        console.log(`    ${chalk.blue('   LOW    ')} ${summary.low} issues`);
    }
    console.log();
}

/**
 * Print fix suggestions
 */
function printFixes(issues: ScanIssue[]): void {
    if (issues.length === 0) return;

    console.log(`  ${chalk.bold('Recommendations:')}`);

    const hasSecrets = issues.some(i => i.type === 'secret');
    const hasPII = issues.some(i => i.type === 'pii');
    const hasConfig = issues.some(i => i.type === 'config');
    const hasVulnerabilities = issues.some(i => i.type === 'vulnerability');
    const hasXSS = issues.some(i => i.category === 'xss');
    const hasInjection = issues.some(i => i.category === 'injection');
    const hasCORS = issues.some(i => i.category === 'cors');
    const hasDebug = issues.some(i => i.category === 'debug');

    if (hasSecrets) {
        console.log(chalk.gray('    - Use environment variables for secrets'));
        console.log(chalk.gray('    - Never commit API keys to version control'));
    }
    if (hasConfig) {
        console.log(chalk.gray('    - Add .env* to .gitignore'));
    }
    if (hasPII) {
        console.log(chalk.gray('    - Remove personal data from source code'));
    }
    if (hasXSS) {
        console.log(chalk.gray('    - Sanitize user input before rendering HTML'));
        console.log(chalk.gray('    - Use textContent instead of innerHTML'));
    }
    if (hasInjection) {
        console.log(chalk.gray('    - Use parameterized queries for SQL'));
        console.log(chalk.gray('    - Avoid using eval and dynamic code execution'));
    }
    if (hasCORS) {
        console.log(chalk.gray('    - Configure CORS with specific allowed origins'));
    }
    if (hasDebug) {
        console.log(chalk.gray('    - Remove console.log statements before production'));
        console.log(chalk.gray('    - Use environment variables for debug flags'));
    }

    console.log();
}

/**
 * Print footer with links
 */
function printFooter(): void {
    console.log(chalk.gray('  ─────────────────────────────────────────────'));
    console.log();
    console.log(`  Share: ${chalk.cyan('https://scan.cencori.com')}`);
    console.log(`  Docs:  ${chalk.cyan('https://cencori.com/docs')}`);
    console.log();
}

/**
 * Main CLI function
 */
async function main(): Promise<void> {
    program
        .name('cencori-scan')
        .description('Security scanner for AI apps. Detect secrets, PII, and exposed routes.')
        .version(VERSION)
        .argument('[path]', 'Path to scan', '.')
        .option('-j, --json', 'Output results as JSON')
        .option('-q, --quiet', 'Only output the score')
        .option('--no-color', 'Disable colored output')
        .action(async (targetPath: string, options: { json?: boolean; quiet?: boolean }) => {
            if (options.json) {
                // JSON output mode
                const result = await scan(targetPath);
                console.log(JSON.stringify(result, null, 2));
                process.exit(result.score === 'A' || result.score === 'B' ? 0 : 1);
                return;
            }

            printBanner();

            const spinner = ora({
                text: 'Scanning for security issues...',
                color: 'cyan',
            }).start();

            try {
                const result = await scan(targetPath);

                spinner.succeed(`Scanned ${result.filesScanned} files`);

                if (options.quiet) {
                    const style = scoreStyles[result.score];
                    console.log(`\n  Score: ${style.color.bold(result.score + '-Tier')}\n`);
                    process.exit(result.score === 'A' || result.score === 'B' ? 0 : 1);
                    return;
                }

                printScore(result);
                printIssues(result.issues);
                printSummary(result);
                printFixes(result.issues);
                printFooter();

                // Exit with error code if issues found
                process.exit(result.score === 'A' || result.score === 'B' ? 0 : 1);
            } catch (error) {
                spinner.fail('Scan failed');
                console.error(chalk.red(`\n  Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
                process.exit(1);
            }
        });

    program.parse();
}

main();
