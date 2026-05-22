/**
 * Shared utilities for create-cencori-app
 */

import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const RESERVED_PACKAGE_NAMES = new Set([
    'node_modules',
    'favicon.ico',
]);

/**
 * Validate a project name
 */
export function validateProjectName(name: string): { valid: boolean; reason?: string } {
    const trimmedName = name.trim();

    if (!trimmedName) {
        return { valid: false, reason: 'Project name is required.' };
    }

    if (trimmedName !== name) {
        return { valid: false, reason: 'Project name cannot start or end with whitespace.' };
    }

    if (trimmedName.toLowerCase() !== trimmedName) {
        return { valid: false, reason: 'Project name must be lowercase.' };
    }

    if (!/^[a-z0-9._-]+$/.test(trimmedName)) {
        return {
            valid: false,
            reason: 'Project name can only contain lowercase letters, numbers, hyphens, underscores, and dots.',
        };
    }

    if (trimmedName.startsWith('.') || trimmedName.startsWith('-')) {
        return { valid: false, reason: 'Project name cannot start with a dot or hyphen.' };
    }

    if (trimmedName.includes('..')) {
        return { valid: false, reason: 'Project name cannot contain consecutive dots.' };
    }

    if (RESERVED_PACKAGE_NAMES.has(trimmedName)) {
        return { valid: false, reason: `"${trimmedName}" is a reserved package name.` };
    }

    if (trimmedName.length > 214) {
        return { valid: false, reason: 'Project name is too long (max 214 characters).' };
    }

    return { valid: true };
}

/**
 * Write template files to the target directory
 */
export function writeTemplateFiles(targetDir: string, files: Record<string, string>): void {
    for (const [relativePath, content] of Object.entries(files)) {
        const fullPath = path.join(targetDir, relativePath);
        const dir = path.dirname(fullPath);

        // Create parent directories
        fs.mkdirSync(dir, { recursive: true });

        // Write file (handle base64 encoding for binary files)
        if (content.startsWith('__BASE64__')) {
            fs.writeFileSync(fullPath, content.substring(10), 'base64');
        } else {
            fs.writeFileSync(fullPath, content, 'utf-8');
        }
    }
}

/**
 * Run npm install in the target directory
 */
export async function runInstall(targetDir: string): Promise<void> {
    execSync('npm install', {
        cwd: targetDir,
        stdio: 'pipe',
        env: { ...process.env, ADBLOCK: '1', DISABLE_OPENCOLLECTIVE: '1' },
    });
}

/**
 * Print the success message with next steps
 */
export function printSuccess(projectName: string, template: string, includeChat: boolean, startDev = false): void {
    const templateLabel = template === 'nextjs'
        ? 'Next.js + Vercel AI SDK'
        : template === 'tanstack'
            ? 'TanStack + React Query'
            : template === 'agent'
                ? 'Cencori Agent Starter'
                : 'Celo Agent Integration Starter';
    const envFile = template === 'nextjs' ? '.env.local' : '.env';
    const isAgentStarter = template === 'agent' || template === 'celo-agent';
    const startCommand = isAgentStarter ? 'npm run demo' : 'npm run dev';
    const localUrl = isAgentStarter ? null : 'http://localhost:3000';

    console.log();
    console.log(chalk.gray('  ─────────────────────────────────────────────'));
    console.log();
    console.log(`  ${chalk.green.bold('Success!')} Created ${chalk.bold(projectName)}`);
    console.log(chalk.gray(`  Template: ${templateLabel}`));
    if (includeChat && !isAgentStarter) {
        console.log(chalk.gray(`  Chat UI: included`));
    }
    if (startDev) {
        console.log(chalk.gray(isAgentStarter ? '  Demo: running' : '  Dev server: starting'));
    }
    console.log();

    if (!startDev) {
        console.log(`  ${chalk.bold('Next steps:')}`);
        console.log();
        console.log(`    ${chalk.cyan('cd')} ${projectName}`);
        console.log();
        console.log(`    ${chalk.gray('1.')} Add your API key:`);
        console.log(`       Open ${chalk.cyan(envFile)} and set ${chalk.cyan('CENCORI_API_KEY=csk_...')}`);
        console.log(`       Get a key → ${chalk.cyan('https://cencori.com/dashboard')}`);
        console.log(`       Confirm provider access in your project ${chalk.cyan('Providers')} page.`);
        if (isAgentStarter) {
            console.log(
                `       Optional: set ${chalk.cyan('CENCORI_AGENT_ID')} to a dashboard agent UUID (leave empty for project-key-only).`
            );
        }
        if (template === 'celo-agent') {
            console.log(`       Optional: set ${chalk.cyan('CELO_PRIVATE_KEY')} and ${chalk.cyan('CELO_RECEIPTS_CONTRACT')} to record onchain.`);
        }
        console.log();
        console.log(`    ${chalk.gray('2.')} Start building:`);
        console.log(`       ${chalk.cyan(startCommand)}`);
        if (localUrl) {
            console.log();
            console.log(`    ${chalk.gray('3.')} Open ${chalk.cyan(localUrl)}`);
        } else {
            console.log();
            console.log(`    ${chalk.gray('3.')} Check the generated receipt in ${chalk.cyan('output/')}`);
        }
    }
    console.log();
    console.log(chalk.gray('  ─────────────────────────────────────────────'));
    console.log();
    console.log(`  Docs:  ${chalk.cyan('https://cencori.com/docs')}`);
    console.log(`  SDK:   ${chalk.cyan('https://github.com/cencori/cencori')}`);
    console.log();
    console.log(chalk.green('  ✔ Done'));
    console.log();
}
