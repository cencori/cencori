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
 *   npx create-cencori-app my-agent --template agent
 *   npx create-cencori-app my-agent --template celo-agent
 */

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { select, confirm, password } from '@inquirer/prompts';
import { validateProjectName, writeTemplateFiles, runInstall, printSuccess } from './utils';
import { getNextjsTemplate } from './templates/nextjs';
import { getTanstackTemplate } from './templates/tanstack';
import { getAgentTemplate } from './templates/agent';
import { getCeloAgentTemplate } from './templates/celo-agent';
import packageJson from '../package.json';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, execSync } from 'child_process';

const VERSION = packageJson.version;

type Template = 'nextjs' | 'tanstack' | 'agent' | 'celo-agent';
const TEMPLATES: Template[] = ['nextjs', 'tanstack', 'agent', 'celo-agent'];

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

function patchChatContent(content: string): string {
    let patched = content;
    if (!patched.includes('DefaultChatTransport')) {
        const useChatImportRegex = /import\s+{[^}]*useChat[^}]*}\s+from\s+['"]@ai-sdk\/react['"];?/g;
        if (useChatImportRegex.test(patched)) {
            patched = patched.replace(
                useChatImportRegex,
                (match) => `${match}\nimport { DefaultChatTransport } from 'ai';`
            );
        } else {
            patched = `import { DefaultChatTransport } from 'ai';\n${patched}`;
        }
    }

    patched = patched.replace(/useChat\(\s*\{([\s\S]*?)\}\s*\)/g, (match, optionsBody) => {
        if (optionsBody.includes('transport:') || !optionsBody.includes('api:')) {
            return match;
        }

        const apiRegex = /api:\s*('[^']+'|"[^"]+"|\`[^\`]+\`|[^\s,]+)/;
        const apiMatch = optionsBody.match(apiRegex);
        if (apiMatch) {
            const apiValue = apiMatch[1];
            const newOptionsBody = optionsBody.replace(
                apiRegex,
                `transport: new DefaultChatTransport({ api: ${apiValue} })`
            );
            return `useChat({${newOptionsBody}})`;
        }
        return match;
    });

    return patched;
}

function findAndPatchFiles(dir: string, modifiedFiles: string[]): void {
    const ignoredDirs = new Set([
        'node_modules',
        '.next',
        'dist',
        '.git',
        'build',
        'out',
        '.vercel',
    ]);

    function traverse(currentDir: string) {
        if (!fs.existsSync(currentDir)) return;
        const files = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const file of files) {
            const fullPath = path.join(currentDir, file.name);

            if (file.isDirectory()) {
                if (!ignoredDirs.has(file.name)) {
                    traverse(fullPath);
                }
            } else if (file.isFile()) {
                const ext = path.extname(file.name);
                if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
                    const content = fs.readFileSync(fullPath, 'utf8');

                    if (content.includes('useChat') && content.includes('api:') && !content.includes('DefaultChatTransport')) {
                        const newContent = patchChatContent(content);
                        if (newContent !== content) {
                            fs.writeFileSync(fullPath, newContent, 'utf8');
                            modifiedFiles.push(fullPath);
                        }
                    }
                }
            }
        }
    }

    traverse(dir);
}

function detectPackageManager(projectDir: string): { command: string; args: string[] } {
    if (fs.existsSync(path.join(projectDir, 'pnpm-lock.yaml'))) {
        return { command: 'pnpm', args: ['install'] };
    }
    if (fs.existsSync(path.join(projectDir, 'yarn.lock'))) {
        return { command: 'yarn', args: ['install'] };
    }
    if (fs.existsSync(path.join(projectDir, 'bun.lockb'))) {
        return { command: 'bun', args: ['install'] };
    }
    return { command: 'npm', args: ['install'] };
}

async function handleUpgrade(): Promise<void> {
    printBanner();
    console.log(chalk.cyan.bold('  Upgrade Project') + chalk.gray(' — patching dependencies and source files'));
    console.log();

    const projectDir = process.cwd();
    const pkgPath = path.join(projectDir, 'package.json');

    if (!fs.existsSync(pkgPath)) {
        console.log(chalk.red('  ✖ No package.json found in the current directory.'));
        console.log(chalk.gray('    Make sure you are running this command from your project root.'));
        console.log();
        process.exit(1);
    }

    let pkg: any;
    try {
        pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch (error) {
        console.log(chalk.red('  ✖ Failed to parse package.json.'));
        console.log();
        process.exit(1);
    }

    const hasCencori = 
        (pkg.dependencies && pkg.dependencies['cencori']) || 
        (pkg.devDependencies && pkg.devDependencies['cencori']) ||
        pkg.name === 'cencori';

    if (!hasCencori) {
        console.log(chalk.red('  ✖ This does not appear to be a Cencori project.'));
        console.log(chalk.gray('    No "cencori" dependency found in package.json.'));
        console.log();
        process.exit(1);
    }

    const isNextjs = pkg.dependencies && pkg.dependencies['next'];
    if (!isNextjs) {
        console.log(chalk.yellow('  ⚠ Upgrade is currently only supported for Next.js templates.'));
        console.log(chalk.gray('    No "next" dependency found in package.json.'));
        console.log();
        return;
    }

    const upgradeSpinner = ora({
        text: 'Upgrading package.json dependencies...',
        color: 'cyan',
    }).start();

    let packageJsonChanged = false;

    if (pkg.dependencies) {
        if (pkg.dependencies['ai'] && pkg.dependencies['ai'] !== '^6.0.0') {
            pkg.dependencies['ai'] = '^6.0.0';
            packageJsonChanged = true;
        }
        if (pkg.dependencies['@ai-sdk/react'] && pkg.dependencies['@ai-sdk/react'] !== '^6.0.0') {
            pkg.dependencies['@ai-sdk/react'] = '^6.0.0';
            packageJsonChanged = true;
        }
    }

    if (packageJsonChanged) {
        try {
            fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + '\n', 'utf8');
            upgradeSpinner.succeed('Upgraded package.json dependencies');
        } catch (error) {
            upgradeSpinner.fail('Failed to write package.json');
            console.error(chalk.red(`  ${error instanceof Error ? error.message : 'Unknown error'}`));
            process.exit(1);
        }
    } else {
        upgradeSpinner.info('Dependencies are already up to date');
    }

    const patchSpinner = ora({
        text: 'Scanning project files for chat components...',
        color: 'cyan',
    }).start();

    const modifiedFiles: string[] = [];
    try {
        findAndPatchFiles(projectDir, modifiedFiles);
        if (modifiedFiles.length > 0) {
            patchSpinner.succeed(`Patched ${modifiedFiles.length} file(s):`);
            modifiedFiles.forEach((file) => {
                console.log(chalk.gray(`    - ${path.relative(projectDir, file)}`));
            });
        } else {
            patchSpinner.info('No files required patching');
        }
    } catch (error) {
        patchSpinner.fail('Failed to patch project files');
        console.error(chalk.red(`  ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
    }

    console.log();
    const installSpinner = ora({
        text: 'Running package manager installation...',
        color: 'cyan',
    }).start();

    try {
        const { command, args } = detectPackageManager(projectDir);
        installSpinner.text = `Installing dependencies with ${command}...`;
        execSync(`${command} ${args.join(' ')}`, {
            cwd: projectDir,
            stdio: 'ignore',
            env: { ...process.env, ADBLOCK: '1', DISABLE_OPENCOLLECTIVE: '1' },
        });
        installSpinner.succeed(`Installed dependencies successfully with ${command}`);
    } catch (error) {
        installSpinner.warn('Failed to auto-install dependencies');
        console.log(chalk.gray('    Please run your package manager install command (e.g. npm install) manually.'));
    }

    console.log();
    console.log(chalk.green.bold('  ✔ Upgrade complete!'));
    console.log();
}

async function main(): Promise<void> {
    program
        .name('create-cencori-app')
        .description('Create a new AI app powered by Cencori.')
        .version(VERSION)
        .argument('<project-name>', 'Name of your project')
        .option('-t, --template <template>', 'Template to use (nextjs, tanstack, agent, or celo-agent)')
        .option('--no-chat', 'Skip the demo chat UI component')
        .option('--no-install', 'Skip installing dependencies')
        .option('--api-key <key>', 'Pre-fill your Cencori API key')
        .option('--dev', 'Start the dev server or run the agent demo after scaffolding')
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
                    message: 'Select a template:',
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
                        {
                            name: 'Cencori Agent (Gateway + run receipts)',
                            value: 'agent',
                            description: 'Cencori-native agent starter with Gateway, controls, and local run receipts',
                        },
                        {
                            name: 'Celo Agent (Cencori + Celo receipts)',
                            value: 'celo-agent',
                            description: 'Integration starter that layers Celo Sepolia receipts on the Cencori agent core',
                        },
                    ],
                });
            }

            if (template === 'agent' || template === 'celo-agent') {
                includeChat = false;
            } else if (chatOptionSource === 'default' && process.stdin.isTTY) {
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
                    : template === 'tanstack'
                        ? 'TanStack + React Query'
                        : template === 'agent'
                            ? 'Cencori Agent Starter'
                            : 'Celo Agent Integration Starter';

                const files = template === 'nextjs'
                    ? getNextjsTemplate({ projectName, includeChat, apiKey })
                    : template === 'tanstack'
                        ? getTanstackTemplate({ projectName, includeChat, apiKey })
                        : template === 'agent'
                            ? getAgentTemplate({ projectName, apiKey })
                            : getCeloAgentTemplate({ projectName, apiKey });

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
                const command = template === 'agent' || template === 'celo-agent' ? 'demo' : 'dev';
                console.log(chalk.cyan(command === 'demo' ? 'Running agent demo...' : 'Starting dev server...'));
                console.log();
                spawn('npm', ['run', command], { cwd: targetDir, stdio: 'inherit' });
            }
        });

    program
        .command('upgrade')
        .description('Upgrade an existing Cencori project to the latest templates and patch errors')
        .action(async () => {
            await handleUpgrade();
        });

    program.parse();
}

main().catch((error) => {
    console.error(chalk.red(`\n  Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
});
