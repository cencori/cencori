/**
 * Sends the Tensor launch email (lib/email/tensor-launch.ts) to a list of people: the Tensor
 * waitlist and Cencori's users. A dry run unless --send is given.
 *
 * The list is a JSON file of { email, name?, userId?, waitlistId? }, taken from the database by
 * whoever runs this. Someone with a userId gets the account unsubscribe link, someone with only a
 * waitlistId the waitlist's; an entry with neither is refused, because it could not unsubscribe.
 *
 * Every address written to is appended to <list>.sent, and addresses already in it are skipped,
 * so a run that stops half-way can be run again without writing to anyone twice.
 *
 * Usage:
 *   npx tsx scripts/send-tensor-launch-bulk.ts recipients.json            (dry run)
 *   npx tsx scripts/send-tensor-launch-bulk.ts recipients.json --send
 */

import fs from 'node:fs';
import path from 'node:path';

for (const filename of ['.env', '.env.local']) {
    const envPath = path.resolve(process.cwd(), filename);
    if (!fs.existsSync(envPath)) continue;
    fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eq = trimmed.indexOf('=');
        if (eq === -1) return;
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (!(key in process.env)) process.env[key] = value;
    });
}

const TOGETHER = 10;
const PAUSE_MS = 200;
const BASE_URL = 'https://cencori.com';

interface Recipient {
    email: string;
    name?: string | null;
    userId?: string | null;
    waitlistId?: string | null;
}

async function main() {
    const listPath = process.argv[2];
    const send = process.argv.includes('--send');
    if (!listPath || listPath.startsWith('--')) throw new Error('Give the recipients JSON file.');

    const apiKey = process.env.SENDBYTE_API_KEY || process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('SENDBYTE_API_KEY or RESEND_API_KEY must be set');
    const from = process.env.RESEND_UPDATES_FROM_EMAIL || process.env.RESEND_FROM_EMAIL;
    if (!from) throw new Error('RESEND_UPDATES_FROM_EMAIL or RESEND_FROM_EMAIL must be set');
    const replyToList = (process.env.RESEND_UPDATES_REPLY_TO_EMAIL || process.env.RESEND_REPLY_TO_EMAIL || '')
        .split(',').map((address) => address.trim()).filter((address) => address.includes('@'));
    const replyTo = replyToList.length === 1 ? replyToList[0] : replyToList.length ? replyToList : undefined;

    const { tensorLaunchEmail, tensorWaitlistUnsubscribeUrl, waitlistFirstName } = await import('../lib/email/tensor-launch');
    const { buildUserUnsubscribeUrl, generateUserUnsubscribeToken } = await import('../lib/user-unsubscribe');

    const sentPath = `${listPath}.sent`;
    const already = new Set(
        fs.existsSync(sentPath) ? fs.readFileSync(sentPath, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean) : [],
    );

    const listed = JSON.parse(fs.readFileSync(listPath, 'utf8')) as Recipient[];
    const seen = new Set<string>();
    const recipients: Recipient[] = [];
    let refused = 0;
    for (const entry of listed) {
        const email = entry.email?.trim().toLowerCase();
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || /@phone\.invalid$/.test(email)) { refused += 1; continue; }
        if (!entry.userId && !entry.waitlistId) { refused += 1; continue; }
        if (seen.has(email)) continue;
        seen.add(email);
        if (!already.has(email)) recipients.push({ ...entry, email });
    }

    const unsubscribeUrl = (recipient: Recipient) =>
        recipient.userId
            ? buildUserUnsubscribeUrl(BASE_URL, recipient.userId, generateUserUnsubscribeToken(recipient.userId))
            : tensorWaitlistUnsubscribeUrl(BASE_URL, recipient.waitlistId as string);

    console.log('=== Tensor launch email ===');
    console.log(`Listed: ${listed.length}   unique: ${seen.size}   refused: ${refused}   already sent: ${seen.size - recipients.length}`);
    console.log(`To send now: ${recipients.length} (${recipients.filter((r) => r.userId).length} with an account, ${recipients.filter((r) => !r.userId).length} waitlist only)`);
    console.log(`Named: ${recipients.filter((r) => waitlistFirstName(r.name)).length}`);
    console.log(`From: ${from}`);
    if (!send) {
        console.log('Dry run. No emails sent.');
        return;
    }

    const { SendByte } = await import('@sendbyte/node');
    const sendbyte = new SendByte(apiKey);
    let sent = 0;
    const failures: string[] = [];
    for (let start = 0; start < recipients.length; start += TOGETHER) {
        await Promise.all(recipients.slice(start, start + TOGETHER).map(async (recipient) => {
            const link = unsubscribeUrl(recipient);
            const email = tensorLaunchEmail({ firstName: waitlistFirstName(recipient.name), unsubscribeUrl: link });
            try {
                await sendbyte.emails.send({
                    from,
                    to: recipient.email,
                    reply_to: replyTo,
                    subject: email.subject,
                    html: email.html,
                    list_unsubscribe: { url: link },
                });
                fs.appendFileSync(sentPath, `${recipient.email}\n`);
                sent += 1;
            } catch (error) {
                failures.push(`${recipient.email}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }));
        process.stdout.write(`\rProgress: ${Math.min(start + TOGETHER, recipients.length)}/${recipients.length} (sent ${sent}, failed ${failures.length})`);
        await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    }
    process.stdout.write('\n');
    console.log(`Sent: ${sent}   Failed: ${failures.length}`);
    for (const failure of failures.slice(0, 20)) console.log(`  ${failure}`);
}

main().catch((error) => {
    console.error('Send failed:', error instanceof Error ? error.message : error);
    process.exit(1);
});
