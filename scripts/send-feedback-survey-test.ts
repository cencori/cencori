/**
 * Sends the Cencori feedback survey email to one test recipient.
 *
 * Usage:
 *   npx tsx scripts/send-feedback-survey-test.ts
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

const RECIPIENT = 'royadebanjo@gmail.com';
const FROM = 'Bola from Cencori <updates@send.cencori.com>';
const SUBJECT = 'Help me shape what Cencori becomes next';
const SURVEY_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScgzM8aoaNi1gTjSvw0ExcFj4VfM5AHoi3lPSWOsTWUP_55GQ/viewform?usp=sharing';

async function main() {
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

  const { launchTemplate } = await import('../lib/email-templates');
  const { SendByte } = await import('@sendbyte/node');
  const sendbyte = new SendByte(apiKey);

  const preferencesUrl = 'https://cencori.com/dashboard';
  const unsubscribeUrl = 'https://cencori.com/account/email-preferences';
  const html = launchTemplate({
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

  console.log(`Sending feedback survey test to ${RECIPIENT}...`);
  console.log(`From: ${FROM}`);
  console.log(`Subject: ${SUBJECT}`);

  const result = await sendbyte.emails.send({
    from: FROM,
    to: RECIPIENT,
    reply_to: replyTo,
    subject: SUBJECT,
    html,
  });

  console.log('Sent successfully.');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error('Send failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
