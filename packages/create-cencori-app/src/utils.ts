/**
 * Shared utilities for create-cencori-app
 */

import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * Validate a project name
 */
export function validateProjectName(name: string): { valid: boolean; reason?: string } {
    if (!name || name.trim() === '') {
        return { valid: false, reason: 'Project name is required.' };
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
        return {
            valid: false,
            reason: 'Project name can only contain letters, numbers, hyphens, underscores, and dots.',
        };
    }

    if (name.startsWith('.') || name.startsWith('-')) {
        return { valid: false, reason: 'Project name cannot start with a dot or hyphen.' };
    }

    if (name.length > 214) {
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
export function printSuccess(projectName: string, template: string, includeChat: boolean): void {
    const templateLabel = template === 'nextjs'
        ? 'Next.js + Vercel AI SDK'
        : 'TanStack + React Query';

    console.log();
    console.log(chalk.gray('  ─────────────────────────────────────────────'));
    console.log();
    console.log(`  ${chalk.green.bold('Success!')} Created ${chalk.bold(projectName)}`);
    console.log(chalk.gray(`  Template: ${templateLabel}`));
    if (includeChat) {
        console.log(chalk.gray(`  Chat UI: included`));
    }
    console.log();

    console.log(`  ${chalk.bold('Next steps:')}`);
    console.log();
    console.log(`    ${chalk.cyan('cd')} ${projectName}`);
    console.log();
    console.log(`    ${chalk.gray('1.')} Add your API key:`);
    console.log(`       Open ${chalk.cyan('.env.local')} and set ${chalk.cyan('CENCORI_API_KEY=csk_...')}`);
    console.log(`       Get a key → ${chalk.cyan('https://cencori.com/dashboard')}`);
    console.log();
    console.log(`    ${chalk.gray('2.')} Start building:`);
    console.log(`       ${chalk.cyan('npm run dev')}`);
    console.log();
    console.log(`    ${chalk.gray('3.')} Open ${chalk.cyan('http://localhost:3000')}`);
    console.log();
    console.log(chalk.gray('  ─────────────────────────────────────────────'));
    console.log();
    console.log(`  Docs:  ${chalk.cyan('https://cencori.com/docs')}`);
    console.log(`  SDK:   ${chalk.cyan('https://github.com/cencori/cencori')}`);
    console.log();
    console.log(chalk.green('  ✔ Done'));
    console.log();
}
