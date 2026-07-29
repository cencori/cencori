import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import chalk from 'chalk';
import { loadConfig } from './config';
import type { McpConfig } from './config';
import { createServer } from './server';
import { VERSION } from './version';

function printBanner(config: McpConfig): void {
    const tier = config.capabilities.destructive
        ? 'read+write+destructive'
        : config.capabilities.write
          ? 'read+write'
          : 'read-only';
    const tierColor = config.capabilities.destructive
        ? chalk.red
        : config.capabilities.write
          ? chalk.yellow
          : chalk.gray;
    const features = Object.entries(config.features)
        .filter(([, enabled]) => enabled)
        .map(([feature]) => feature)
        .join(', ');

    console.error();
    console.error(`  ${chalk.cyan.bold('Cencori MCP')} ${chalk.gray(`v${VERSION}`)}`);
    console.error();
    console.error(`  ${chalk.gray('tier'.padEnd(8))}  ${tierColor(tier)}`);
    console.error(`  ${chalk.gray('base'.padEnd(8))}  ${chalk.cyan(config.baseUrl)}`);
    console.error(`  ${chalk.gray('features'.padEnd(8))}  ${features || chalk.gray('none')}`);
    console.error(
        `  ${chalk.gray('api key'.padEnd(8))}  ${config.apiKey ? chalk.green('configured') : chalk.yellow('not set')}`,
    );
    console.error();
}

async function main(): Promise<void> {
    const config = loadConfig();
    const server = createServer(config);
    const transport = new StdioServerTransport();

    await server.connect(transport);
    printBanner(config);
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
