#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { confirm, password } from '@inquirer/prompts';
import { scan, type ScanResult, type ScanIssue } from './scanner/index.js';
import {
    getApiKey,
    setSessionApiKey,
    saveApiKey,
    validateApiKey,
    analyzeIssues,
    generateFixes,
    applyFixes,
} from './ai/index.js';
import { sendTelemetry, buildTelemetryData, flushTelemetry } from './telemetry.js';
import * as fs from 'fs';
import * as path from 'path';

const VERSION = '0.3.8';

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
 * Print recommendations
 */
function printRecommendations(issues: ScanIssue[]): void {
    if (issues.length === 0) return;

    console.log(`  ${chalk.bold('Recommendations:')}`);

    const hasSecrets = issues.some(i => i.type === 'secret');
    const hasPII = issues.some(i => i.type === 'pii');
    const hasConfig = issues.some(i => i.type === 'config');
    const hasXSS = issues.some(i => i.category === 'xss');
    const hasInjection = issues.some(i => i.category === 'injection');
    const hasCORS = issues.some(i => i.category === 'cors');

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
    }
    if (hasInjection) {
        console.log(chalk.gray('    - Use parameterized queries for SQL'));
    }
    if (hasCORS) {
        console.log(chalk.gray('    - Configure CORS with specific allowed origins'));
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
 * Load file contents for AI analysis
 */
function loadFileContents(issues: ScanIssue[], basePath: string): Map<string, string> {
    const contents = new Map<string, string>();
    const uniqueFiles = [...new Set(issues.map(i => i.file))];

    for (const file of uniqueFiles) {
        try {
            const fullPath = path.resolve(basePath, file);
            const content = fs.readFileSync(fullPath, 'utf-8');
            contents.set(file, content);
        } catch {
            // Skip files that can't be read
        }
    }

    return contents;
}

/**
 * Prompt user for API key (hidden input)
 */
async function promptForApiKey(): Promise<string | undefined> {
    console.log();
    console.log(chalk.gray('  ─────────────────────────────────────────────'));
    console.log();
    console.log(`  ${chalk.cyan.bold('Cencori Pro')}`);
    console.log(chalk.gray('  AI-powered auto-fix requires an API key.'));
    console.log();
    console.log(`  Get your free API key at:`);
    console.log(`  ${chalk.cyan('https://cencori.com/dashboard')} → API Keys`);
    console.log();

    try {
        const apiKey = await password({
            message: 'Enter your Cencori API key:',
            mask: '*',
        });

        if (!apiKey || apiKey.trim() === '') {
            console.log(chalk.yellow('  No API key entered. Skipping auto-fix.'));
            return undefined;
        }

        return apiKey.trim();
    } catch {
        return undefined;
    }
}

/**
 * Handle AI auto-fix flow
 */
async function handleAutoFix(
    result: ScanResult,
    targetPath: string
): Promise<void> {
    if (result.issues.length === 0) return;

    console.log();

    // Ask user if they want to auto-fix
    const shouldFix = await confirm({
        message: 'Would you like Cencori to auto-fix these issues?',
        default: false,
    });

    if (!shouldFix) {
        console.log();
        console.log(chalk.gray('  Skipped auto-fix. Run again anytime to fix issues.'));
        console.log();
        return;
    }

    // Check if we have an API key
    let apiKey = getApiKey();

    if (!apiKey) {
        // Prompt for API key
        apiKey = await promptForApiKey();

        if (!apiKey) {
            console.log();
            return;
        }

        // Validate the API key
        const validatingSpinner = ora({
            text: 'Validating API key...',
            color: 'cyan',
        }).start();

        const isValid = await validateApiKey(apiKey);

        if (!isValid) {
            validatingSpinner.fail('Invalid API key');
            console.log(chalk.red('  The API key could not be validated. Please check and try again.'));
            console.log();
            return;
        }

        validatingSpinner.succeed('API key validated');

        // Save the API key for future use
        try {
            saveApiKey(apiKey);
            console.log(chalk.green('  ✔ API key saved to ~/.cencorirc'));
        } catch {
            // Non-fatal, just won't be saved
        }

        // Set for current session
        setSessionApiKey(apiKey);
    } else {
        console.log(chalk.gray('  Using saved API key...'));
    }

    // Load file contents
    const fileContents = loadFileContents(result.issues, targetPath);

    // Analyze with AI
    const analyzeSpinner = ora({
        text: 'Analyzing issues with AI...',
        color: 'cyan',
    }).start();

    try {
        const analysis = await analyzeIssues(result.issues, fileContents);

        // Filter out false positives
        const realIssues = analysis.filter(a => !a.isFalsePositive);
        const falsePositives = analysis.filter(a => a.isFalsePositive);

        if (falsePositives.length > 0) {
            analyzeSpinner.succeed(`${chalk.green(falsePositives.length)} false positives filtered`);
        } else {
            analyzeSpinner.succeed('Analysis complete');
        }

        if (realIssues.length === 0) {
            console.log(chalk.green('  All issues were false positives!'));
            return;
        }

        // Generate fixes
        const fixSpinner = ora({
            text: 'Generating fixes...',
            color: 'cyan',
        }).start();

        const fixes = await generateFixes(
            realIssues.map(a => a.issue),
            fileContents
        );

        fixSpinner.succeed(`Generated ${fixes.length} fixes`);

        // Apply fixes
        const applySpinner = ora({
            text: 'Applying fixes...',
            color: 'cyan',
        }).start();

        const appliedFixes = await applyFixes(fixes, fileContents);
        const appliedCount = appliedFixes.filter(f => f.applied).length;

        applySpinner.succeed(`Applied ${appliedCount}/${fixes.length} fixes`);

        // Show what was fixed
        console.log();
        console.log(`  ${chalk.bold('Applied fixes:')}`);
        for (const fix of appliedFixes.filter(f => f.applied)) {
            console.log(chalk.green(`    ✔ ${fix.issue.file}:${fix.issue.line}`));
            console.log(chalk.gray(`      ${fix.explanation}`));
        }

        const notApplied = appliedFixes.filter(f => !f.applied);
        if (notApplied.length > 0) {
            console.log();
            console.log(`  ${chalk.yellow(`${notApplied.length} issues require manual review`)}`);
        }

        console.log();
    } catch (error) {
        analyzeSpinner.fail('Auto-fix failed');
        console.error(chalk.red(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        console.log();
    }
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
        .option('--no-prompt', 'Skip interactive prompts')
        .option('--no-color', 'Disable colored output')
        .action(async (targetPath: string, options: { json?: boolean; quiet?: boolean; prompt?: boolean }) => {
            if (options.json) {
                const result = await scan(targetPath);
                // Send telemetry for JSON mode too
                sendTelemetry(buildTelemetryData(result, VERSION, !!getApiKey()));
                console.log(JSON.stringify(result, null, 2));
                // Wait for telemetry to complete before exiting
                await flushTelemetry();
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

                // Send telemetry silently in background
                sendTelemetry(buildTelemetryData(result, VERSION, !!getApiKey()));

                spinner.succeed(`Scanned ${result.filesScanned} files`);

                if (options.quiet) {
                    const style = scoreStyles[result.score];
                    console.log(`\n  Score: ${style.color.bold(result.score + '-Tier')}\n`);
                    // Wait for telemetry to complete before exiting
                    await flushTelemetry();
                    process.exit(result.score === 'A' || result.score === 'B' ? 0 : 1);
                    return;
                }

                printScore(result);
                printIssues(result.issues);
                printSummary(result);
                printRecommendations(result.issues);

                // Interactive auto-fix prompt (unless --no-prompt)
                if (options.prompt !== false && result.issues.length > 0) {
                    await handleAutoFix(result, targetPath);
                }

                printFooter();

                // Wait for telemetry to complete before exiting
                await flushTelemetry();
                process.exit(result.score === 'A' || result.score === 'B' ? 0 : 1);
            } catch (error) {
                spinner.fail('Scan failed');
                console.error(chalk.red(`\n  Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
                // Wait for any pending telemetry before exiting
                await flushTelemetry();
                process.exit(1);
            }
        });

    program.parse();
}

main();
