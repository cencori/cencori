/**
 * Sends the Responses API guide test email to a single recipient via SendByte.
 *
 * Uses the shared `launchTemplate()` from lib/email-templates — same design
 * as the Documents and Voice launch emails.
 *
 * Usage:
 *   npx tsx scripts/send-responses-guide-test.ts [recipient@example.com]
 */

import fs from 'node:fs';
import path from 'node:path';

// Load env before importing anything that reads process.env
for (const filename of ['.env', '.env.local']) {
    const envPath = path.resolve(process.cwd(), filename);
    if (!fs.existsSync(envPath)) continue;
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eq = trimmed.indexOf('=');
        if (eq === -1) return;
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (!(key in process.env)) process.env[key] = value;
    });
}

const FROM = 'Eniola from Cencori <updates@send.cencori.com>';

async function main() {
    const recipient = process.argv[2] || 'bolaabanjo@gmail.com';

    const apiKey = process.env.SENDBYTE_API_KEY || process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('SENDBYTE_API_KEY or RESEND_API_KEY must be set');

    // Named sender on the updates@ handle — same as scripts/send-test-roy.ts.
    // Never uses welcome@ — that's reserved for new-user onboarding.
    const from = FROM;

    const replyToRaw = (
        process.env.RESEND_UPDATES_REPLY_TO_EMAIL ||
        process.env.RESEND_REPLY_TO_EMAIL ||
        ''
    ).trim();
    const replyTo = replyToRaw
        ? replyToRaw.split(',').map(s => s.trim()).filter(s => s.includes('@'))
        : undefined;

    const unsubscribeUrl = 'https://cencori.com/account/email-preferences';
    const preferencesUrl = 'https://cencori.com/dashboard';

    const { launchTemplate } = await import('../lib/email-templates');
    const { SendByte } = await import('@sendbyte/node');

    const html = launchTemplate({
        bannerUrl: 'https://cencori.com/docs/og/v1/guides/what-to-build-with-responses.jpg?v=2',
        bannerAlt: 'What to Build with the Responses API',
        preheader: 'Eight things you can ship on one endpoint.',
        greeting: 'Hi builder,',
        paragraphs: [
            'We wrote a new guide for the Responses API.',
            'One endpoint takes an input, optionally gives the model tools, and returns structured output. The guide walks through eight things you can actually ship on it — a research assistant whose citations map to exact spans of the answer, a document Q&A endpoint where the upload and the question are the same request, a strict-schema extractor, an agent that calls your own APIs, a streaming UI, and per-end-user billing.',
            'Every recipe is real code against what ships today. Where something is not ready — code execution is still disabled until it has a properly isolated runtime — the guide says so instead of pretending otherwise.',
            'It also documents the limits worth knowing before you build: 2000 input items, 8 MiB of text, 20 inline files, and a 30-minute TTL on stored responses.',
        ],
        linksHeader: 'Start here:',
        links: [
            { label: 'What to build with the Responses API', url: 'https://cencori.com/docs/guides/what-to-build-with-responses' },
            { label: 'Responses API reference', url: 'https://cencori.com/docs/api/responses' },
            { label: 'Building agents with the Responses API', url: 'https://cencori.com/docs/agents/responses' },
        ],
        ctaText: 'Read the guide',
        ctaUrl: 'https://cencori.com/docs/guides/what-to-build-with-responses',
        signOff: 'Build different.',
        preferencesUrl,
        unsubscribeUrl,
        footerContext: 'You received this because you signed up for Cencori.',
    });

    const sendbyte = new SendByte(apiKey);

    console.log(`Sending Responses guide test to ${recipient}...`);
    console.log(`From:    ${from}`);
    if (replyTo) console.log(`Reply-To: ${replyTo.join(', ')}`);
    console.log(`Greeting: Hi builder,`);

    const result = await sendbyte.emails.send({
        from,
        to: recipient,
        reply_to: replyTo?.length === 1 ? replyTo[0] : replyTo,
        subject: 'What you can build with the Responses API',
        html,
    });

    console.log('\nSent successfully. Response:');
    console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
    console.error('\nSend failed:', err instanceof Error ? err.message : err);
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
});
