/**
 * Sends the Cencori feedback survey to confirmed, marketing-opted-in users.
 *
 * Mandatory dry run:
 *   node --experimental-strip-types scripts/send-feedback-survey-bulk.ts
 *   node --experimental-strip-types scripts/send-feedback-survey-bulk.ts --send
 *   node --experimental-strip-types scripts/send-feedback-survey-bulk.ts --send --max=100
 */

import fs from 'node:fs';
import path from 'node:path';

for (const filename of ['.env', '.env.local']) {
  const envPath = path.resolve(process.cwd(), filename);
  if (!fs.existsSync(envPath)) continue;

  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) return;

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed
      .slice(equalsIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, '');

    if (!(key in process.env)) process.env[key] = value;
  });
}

const FROM = 'Bola from Cencori <updates@send.cencori.com>';
const SUBJECT = 'Help me shape what Cencori becomes next';
const SURVEY_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScgzM8aoaNi1gTjSvw0ExcFj4VfM5AHoi3lPSWOsTWUP_55GQ/viewform?usp=sharing';

const SEND_CONCURRENCY = 25;
const SEND_BATCH_PAUSE_MS = 50;
const USERS_PAGE_SIZE = 200;
const HARD_MAX_RECIPIENTS = 10_000;

interface Recipient {
  email: string;
  userId: string;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const send = args.includes('--send');
  const maxArg = args.find((argument) => argument.startsWith('--max='));
  const requestedMax = maxArg
    ? Number.parseInt(maxArg.slice('--max='.length), 10)
    : HARD_MAX_RECIPIENTS;
  const max = Math.min(
    Math.max(Number.isFinite(requestedMax) ? requestedMax : HARD_MAX_RECIPIENTS, 1),
    HARD_MAX_RECIPIENTS,
  );

  return { send, max };
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  const { send, max } = parseArgs();

  const apiKey = process.env.SENDBYTE_API_KEY || process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('SENDBYTE_API_KEY or RESEND_API_KEY must be set');
  }

  const replyToRaw = (
    process.env.RESEND_UPDATES_REPLY_TO_EMAIL ||
    process.env.RESEND_REPLY_TO_EMAIL ||
    ''
  ).trim();
  const replyToList = replyToRaw
    ? replyToRaw.split(',').map((address) => address.trim()).filter((address) => address.includes('@'))
    : undefined;
  const replyTo = replyToList?.length === 1 ? replyToList[0] : replyToList;

  const { createAdminClient } = await import('../lib/supabaseAdmin');
  const {
    buildUserUnsubscribeUrl,
    generateUserUnsubscribeToken,
    isUserMarketingOptedOut,
  } = await import('../lib/user-unsubscribe');
  const { launchTemplate } = await import('../lib/email-templates');

  const admin = createAdminClient();
  const recipients: Recipient[] = [];
  const dedupe = new Set<string>();
  let page = 1;
  let scanned = 0;
  let skippedUnconfirmed = 0;
  let skippedOptOut = 0;

  while (recipients.length < max) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: USERS_PAGE_SIZE,
    });
    if (error) throw new Error(error.message);

    const users = data?.users ?? [];
    scanned += users.length;

    for (const user of users) {
      const email = user.email?.trim().toLowerCase();
      if (!email || dedupe.has(email)) continue;
      if (!user.email_confirmed_at) {
        skippedUnconfirmed += 1;
        continue;
      }

      const metadata = (user.user_metadata || {}) as Record<string, unknown>;
      if (isUserMarketingOptedOut(metadata)) {
        skippedOptOut += 1;
        continue;
      }

      dedupe.add(email);
      recipients.push({ email, userId: user.id });
      if (recipients.length >= max) break;
    }

    if (!data?.nextPage || users.length === 0) break;
    page = data.nextPage;
  }

  console.log('=== Feedback survey audience ===');
  console.log(`Scanned: ${scanned}`);
  console.log(`Eligible recipients: ${recipients.length}`);
  console.log(`Skipped unconfirmed: ${skippedUnconfirmed}`);
  console.log(`Skipped opted out: ${skippedOptOut}`);
  console.log(`From: ${FROM}`);
  console.log(`Subject: ${SUBJECT}`);

  if (recipients.length === 0) {
    console.log('No eligible recipients. Nothing to send.');
    return;
  }

  if (!send) {
    console.log('Dry run complete. No emails sent.');
    return;
  }

  const { SendByte } = await import('@sendbyte/node');
  const sendbyte = new SendByte(apiKey);
  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'https://cencori.com'
  );
  const preferencesUrl = `${baseUrl}/dashboard`;

  const { data: sendRecord } = await admin
    .from('email_sends')
    .insert({
      category: 'announcement',
      subject: SUBJECT,
      html_body: '(feedback survey bulk script; recipient-specific unsubscribe URL)',
      text_body: null,
      sent_by: null,
      audience_type: 'bulk',
      recipient_count: recipients.length,
      status: 'sending',
    })
    .select('id')
    .single();

  function buildHtml(unsubscribeUrl: string): string {
    return launchTemplate({
      preheader: 'Your feedback will directly shape what we build next.',
      greeting: 'Hey my ski,',
      paragraphs: [
        'It&rsquo;s Bola, Cencori&rsquo;s co-founder.',
        'We&rsquo;re taking a closer look at how people are actually using Cencori&mdash;what&rsquo;s working, what isn&rsquo;t, and what we should build next.',
        'I don&rsquo;t want us to make those decisions based on assumptions. I want to hear directly from you.',
        'We&rsquo;ve put together a short survey, and your answers will directly shape the product decisions we make next.',
      ],
      ctaText: 'Take the survey',
      ctaUrl: SURVEY_URL,
      signOff: 'Please be as honest as possible&mdash;especially if there&rsquo;s something about Cencori you dislike, stopped using, or wish worked differently. You&rsquo;d be doing me and the team a huge favor.<br><br>Thank you for building with us.<br><br>Bola<br>Co-founder &amp; CEO, Cencori',
      preferencesUrl,
      unsubscribeUrl,
      footerContext: 'You received this because you signed up for Cencori.',
    });
  }

  let sent = 0;
  let failed = 0;
  const failures: string[] = [];

  for (let index = 0; index < recipients.length; index += SEND_CONCURRENCY) {
    const batch = recipients.slice(index, index + SEND_CONCURRENCY);
    const results = await Promise.all(batch.map(async (recipient) => {
      const token = generateUserUnsubscribeToken(recipient.userId);
      const unsubscribeUrl = buildUserUnsubscribeUrl(baseUrl, recipient.userId, token);

      try {
        await sendbyte.emails.send({
          from: FROM,
          to: recipient.email,
          reply_to: replyTo,
          subject: SUBJECT,
          html: buildHtml(unsubscribeUrl),
          list_unsubscribe: { url: unsubscribeUrl },
        });
        return { ok: true as const };
      } catch (error) {
        return {
          ok: false as const,
          email: recipient.email,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }));

    for (const result of results) {
      if (result.ok) sent += 1;
      else {
        failed += 1;
        failures.push(`${result.email}: ${result.message}`);
      }
    }

    const processed = index + batch.length;
    process.stdout.write(`\rProgress: ${processed}/${recipients.length} (sent: ${sent}, failed: ${failed})`);

    if (index + SEND_CONCURRENCY < recipients.length) {
      await sleep(SEND_BATCH_PAUSE_MS);
    }
  }

  process.stdout.write('\n');

  if (sendRecord?.id) {
    await admin
      .from('email_sends')
      .update({
        status: failed === recipients.length ? 'failed' : 'sent',
        success_count: sent,
        failure_count: failed,
        sent_at: new Date().toISOString(),
      })
      .eq('id', sendRecord.id);
  }

  console.log('=== Campaign complete ===');
  console.log(`Sent: ${sent}`);
  console.log(`Failed: ${failed}`);
  if (failures.length > 0) {
    console.log('Failures:');
    for (const failure of failures.slice(0, 10)) console.log(`  ${failure}`);
  }
}

main().catch((error) => {
  console.error('Bulk send failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
