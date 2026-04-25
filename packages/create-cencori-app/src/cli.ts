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
import { validateProjectName, writeTemplateFiles, runInstall, printSuccess } from './utils.js';
import { getNextjsTemplate } from './templates/nextjs.js';
import { getTanstackTemplate } from './templates/tanstack.js';
import * as fs from 'fs';
import * as path from 'path';

const VERSION = '1.0.0';

type Template = 'nextjs' | 'tanstack';

interface CreateOptions {
    template?: Template;
    chat?: boolean;
    install?: boolean;
    apiKey?: string;
}

function printBanner(): void {
    console.log();
    console.log(chalk.cyan.bold('  Cencori') + chalk.gray(' — Create App'));
    console.log(chalk.gray(`  v${VERSION}`));
    console.log();
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
            let template: Template = options.template as Template;
            let includeChat = options.chat !== false;
            let apiKey = options.apiKey || '';

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

            if (options.chat === undefined) {
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
            printSuccess(projectName, template, includeChat);
        });

    program.parse();
}

main().catch((error) => {
    console.error(chalk.red(`\n  Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
});
