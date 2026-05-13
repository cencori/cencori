#!/usr/bin/env node

/**
 * create-cencori-app
 *
 * Create a new AI app powered by Cencori in seconds.
 *
 * Usage:
 *   npx create-cencori-app my-project
 *   npx create-cencori-app my-project --template nextjs
 *   npx create-cencori-app my-project --template tanstack --no-chat
 */

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { select, confirm, password } from '@inquirer/prompts';
import { validateProjectName, writeTemplateFiles, runInstall, printSuccess } from './utils';
import { getNextjsTemplate } from './templates/nextjs';
import { getTanstackTemplate } from './templates/tanstack';
import packageJson from '../package.json';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

const VERSION = packageJson.version;

type Template = 'nextjs' | 'tanstack';
const TEMPLATES: Template[] = ['nextjs', 'tanstack'];

interface CreateOptions {
    template?: Template;
    chat?: boolean;
    install?: boolean;
    apiKey?: string;
    dev?: boolean;
}

function printBanner(): void {
    console.log();
    console.log(chalk.cyan.bold('  Cencori') + chalk.gray(' — Create App'));
    console.log(chalk.gray(`  v${VERSION}`));
    console.log();
}

function isTemplate(value: string | undefined): value is Template {
    return value !== undefined && TEMPLATES.includes(value as Template);
}

const CENCORI_API_URL = 'https://api.cencori.com/v1';

async function verifyApiKey(apiKey: string): Promise<'valid' | 'invalid' | 'unknown'> {
    if (!apiKey) return 'valid';
    try {
        // /v1/models validates the project key without creating usage or requiring provider access.
        const response = await fetch(`${CENCORI_API_URL}/models`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
            signal: AbortSignal.timeout(5000),
        });

        if (response.ok) return 'valid';
        if (response.status === 401 || response.status === 403) return 'invalid';
        return 'unknown';
    } catch {
        return 'unknown';
    }
}

async function main(): Promise<void> {
    program
        .name('create-cencori-app')
        .description('Create a new AI app powered by Cencori.')
        .version(VERSION)
        .argument('<project-name>', 'Name of your project')
        .option('-t, --template <template>', 'Template to use (nextjs or tanstack)')
        .option('--no-chat', 'Skip the demo chat UI component')
        .option('--no-install', 'Skip installing dependencies')
        .option('--api-key <key>', 'Pre-fill your Cencori API key')
        .option('--dev', 'Start the dev server after scaffolding')
        .action(async (projectName: string, options: CreateOptions) => {
            printBanner();

            // ── Validate project name ──
            const validation = validateProjectName(projectName);
            if (!validation.valid) {
                console.log(chalk.red(`  ✖ ${validation.reason}`));
                console.log();
                process.exit(1);
            }

            const targetDir = path.resolve(process.cwd(), projectName);

            if (fs.existsSync(targetDir)) {
                console.log(chalk.red(`  ✖ Directory "${projectName}" already exists.`));
                console.log(chalk.gray(`    Remove it or choose a different name.`));
                console.log();
                process.exit(1);
            }

            // ── Interactive prompts (if flags not provided) ──
            if (options.template && !isTemplate(options.template)) {
                console.log(chalk.red(`  ✖ Invalid template "${options.template}".`));
                console.log(chalk.gray(`    Choose one of: ${TEMPLATES.join(', ')}.`));
                console.log();
                process.exit(1);
            }

            let template: Template | undefined = options.template;
            let includeChat = options.chat !== false;
            let apiKey = options.apiKey || '';
            const startDev = options.dev === true;
            const chatOptionSource = program.getOptionValueSource('chat');

            if (!template) {
                template = await select<Template>({
                    message: 'Select a framework:',
                    choices: [
                        {
                            name: 'Next.js (App Router + Vercel AI SDK)',
                            value: 'nextjs',
                            description: 'Full-stack React with streaming, SSR, and server actions',
                        },
                        {
                            name: 'TanStack (Vite + React Query)',
                            value: 'tanstack',
                            description: 'Lightweight React with TanStack Query for data fetching',
                        },
                    ],
                });
            }

            if (chatOptionSource === 'default' && process.stdin.isTTY) {
                includeChat = await confirm({
                    message: 'Include a demo chat UI?',
                    default: true,
                });
            }

            if (!apiKey && process.stdin.isTTY) {
                try {
                    const inputKey = await password({
                        message: 'Your Cencori API key (optional, press Enter to skip):',
                        mask: '*',
                    });
                    if (inputKey && inputKey.trim()) {
                        apiKey = inputKey.trim();
                    }
                } catch {
                    // User cancelled — skip
                }
            }

            // ── Verify API key ──
            if (apiKey && process.env.CENCORI_SKIP_API_KEY_VERIFY !== '1') {
                const verifySpinner = ora({
                    text: 'Verifying API key...',
                    color: 'cyan',
                }).start();

                const verification = await verifyApiKey(apiKey);

                if (verification === 'valid') {
                    verifySpinner.succeed('API key verified');
                } else if (verification === 'invalid') {
                    verifySpinner.fail('Invalid API key');
                    console.log(chalk.gray(`  Get one at ${chalk.cyan('https://cencori.com/dashboard')}`));
                    console.log();
                    process.exit(1);
                } else {
                    verifySpinner.warn('Could not verify API key right now');
                    console.log(chalk.gray('  Continuing anyway. The generated app will use the key from your env file.'));
                }
            }

            console.log();

            // ── Create project ──
            const createSpinner = ora({
                text: 'Creating project...',
                color: 'cyan',
            }).start();

            try {
                fs.mkdirSync(targetDir, { recursive: true });
                createSpinner.succeed(`Created ${chalk.bold(projectName)}`);
            } catch (error) {
                createSpinner.fail('Failed to create project directory');
                console.error(chalk.red(`  ${error instanceof Error ? error.message : 'Unknown error'}`));
                process.exit(1);
            }

            // ── Write template files ──
            const templateSpinner = ora({
                text: `Writing template files...`,
                color: 'cyan',
            }).start();

            try {
                const templateLabel = template === 'nextjs'
                    ? 'Next.js + Vercel AI SDK'
                    : 'TanStack + React Query';

                const files = template === 'nextjs'
                    ? getNextjsTemplate({ projectName, includeChat, apiKey })
                    : getTanstackTemplate({ projectName, includeChat, apiKey });

                writeTemplateFiles(targetDir, files);
                templateSpinner.succeed(`Scaffolded ${chalk.bold(templateLabel)}`);
            } catch (error) {
                templateSpinner.fail('Failed to write template files');
                console.error(chalk.red(`  ${error instanceof Error ? error.message : 'Unknown error'}`));
                process.exit(1);
            }

            // ── Install dependencies ──
            if (options.install !== false) {
                const installSpinner = ora({
                    text: 'Installing dependencies...',
                    color: 'cyan',
                }).start();

                try {
                    await runInstall(targetDir);
                    installSpinner.succeed('Installed dependencies');
                } catch (error) {
                    installSpinner.warn('Failed to install dependencies');
                    console.log(chalk.gray(`  Run ${chalk.cyan('npm install')} manually in the project directory.`));
                }
            }

            // ── Success ──
            printSuccess(projectName, template, includeChat, startDev);

            // ── Start dev server ──
            if (startDev && options.install !== false) {
                console.log(chalk.cyan('Starting dev server...'));
                console.log();
                spawn('npm', ['run', 'dev'], { cwd: targetDir, stdio: 'inherit' });
            }
        });

    program.parse();
}

main().catch((error) => {
    console.error(chalk.red(`\n  Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
});
