/** Send the weekly Cencori update to one test recipient. */

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
    const value = trimmed.slice(equalsIndex + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  });
}

const RECIPIENT = 'omogbolahanng@gmail.com';
const FROM = 'Eniola from Cencori <updates@send.cencori.com>';
const SUBJECT = 'What Cencori Did Last Week 🚀';
const SPACE_URL = 'https://x.com/i/spaces/1DxleVWRNWRKL?s=20';
const SURVEY_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScgzM8aoaNi1gTjSvw0ExcFj4VfM5AHoi3lPSWOsTWUP_55GQ/viewform?usp=sharing';

function button(label: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:500;">${label}</a>`;
}

async function main() {
  const apiKey = process.env.SENDBYTE_API_KEY || process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('SENDBYTE_API_KEY or RESEND_API_KEY must be set');

  const replyToRaw = (
    process.env.RESEND_UPDATES_REPLY_TO_EMAIL ||
    process.env.RESEND_REPLY_TO_EMAIL ||
    ''
  ).trim();
  const replyToList = replyToRaw
    ? replyToRaw.split(',').map((address) => address.trim()).filter((address) => address.includes('@'))
    : undefined;
  const replyTo = replyToList?.length === 1 ? replyToList[0] : replyToList;

  const { launchTemplate } = await import('../lib/email-templates.ts');
  const { SendByte } = await import('@sendbyte/node');

  const html = launchTemplate({
    preheader: 'A quick look at what Cencori was up to last week.',
    greeting: 'Hello builder,',
    paragraphs: [
      'Here&rsquo;s a quick look at what we&rsquo;ve been up to at Cencori this past week.',
      '<strong style="color:#111;">1. Zero markup on provider calls</strong><br>Our gateway now adds $0 markup to provider calls. That means you pay exactly what the provider charges&mdash;nothing more. No hidden fees and no added cost layered on top.',
      '<strong style="color:#111;">2. We joined TechCabal on X Spaces</strong><br>We had a great conversation about what we&rsquo;re building and where we&rsquo;re headed. If you missed it live, you can catch the replay here:',
      button('Listen to the X Space', SPACE_URL),
      '<strong style="color:#111;">3. We&rsquo;re still listening</strong><br>Our developer feedback campaign is still open. If something didn&rsquo;t work for you, if you left, or if there&rsquo;s anything we could&rsquo;ve done better, we want to hear it.',
      button('Share your feedback', SURVEY_URL),
      '<strong style="color:#111;">4. Our Celo Agents Hackathon collaboration wrapped</strong><br>Our partnership with Celo for the Agents Hackathon has officially come to a close. Thanks to everyone who built with Cencori during the event&mdash;more updates on standout builders are coming soon.',
    ],
    signOff: 'Talk soon,<br>Eniola<br>Cencori',
    preferencesUrl: 'https://cencori.com/dashboard',
    unsubscribeUrl: 'https://cencori.com/account/email-preferences',
    footerContext: 'You received this because you signed up for Cencori.',
  });

  const sendbyte = new SendByte(apiKey);
  console.log(`Sending weekly update test to ${RECIPIENT}...`);

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
