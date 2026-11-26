/**
 * Registers Cencori's webhook with Quality, once, so comments on Tensor projects' published apps
 * reach app/api/tensor/quality/webhook. Quality shows the webhook's secret only in this answer,
 * so it is written to a file of your own (readable by you alone) and never printed: put it in
 * Cencori's server environment as QUALITY_WEBHOOK_SECRET, then delete the file.
 *
 * Needs QUALITY_CLIENT_ID and QUALITY_CLIENT_SECRET in the environment (or in .env.local).
 *
 * Usage:
 *   npx tsx scripts/quality-webhook.ts register --out ~/quality-webhook-secret.txt
 *   npx tsx scripts/quality-webhook.ts register --rotate --out ~/quality-webhook-secret.txt
 *   npx tsx scripts/quality-webhook.ts show      (where events go now)
 *   npx tsx scripts/quality-webhook.ts test      (Quality sends a ping)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const URL_DEFAULT = 'https://cencori.com/api/tensor/quality/webhook';

for (const file of ['.env.local', '.env']) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*(QUALITY_[A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2];
  }
}

const args = process.argv.slice(2);
const command = args[0];
const option = (name: string) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? undefined : args[at + 1];
};

const clientId = process.env.QUALITY_CLIENT_ID?.trim();
const clientSecret = process.env.QUALITY_CLIENT_SECRET?.trim();
const api = (process.env.QUALITY_API_ORIGIN?.trim() || 'https://server.usequality.app').replace(/\/+$/, '');
if (!clientId || !clientSecret) {
  console.error('QUALITY_CLIENT_ID and QUALITY_CLIENT_SECRET are needed.');
  process.exit(2);
}

async function token(): Promise<string> {
  const response = await fetch(`${api}/oauth/apps/token`, {
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  });
  const said = (await response.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!response.ok || !said.access_token) throw new Error(`Quality refused the credentials (${said.error ?? response.status}).`);
  return said.access_token;
}

async function call(method: string, suffix: string, body?: unknown) {
  const response = await fetch(`${api}/api/v1/partner/webhook${suffix}`, {
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: { authorization: `Bearer ${await token()}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    method,
  });
  const said = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(`Quality answered ${response.status}: ${String(said.error ?? '')}`);
  return said;
}

async function main() {
  if (command === 'register') {
    const out = option('out');
    if (!out) throw new Error('Say where to keep the secret: --out <file>.');
    const file = path.resolve(out.replace(/^~(?=$|\/)/, os.homedir()));
    const said = await call('PUT', '', { url: option('url') ?? URL_DEFAULT, ...(args.includes('--rotate') ? { rotate_secret: true } : {}) });
    console.log(`Events now go to ${String(said.url)} (${JSON.stringify(said.events ?? [])}).`);
    if (typeof said.secret === 'string') {
      fs.writeFileSync(file, `${said.secret}\n`, { mode: 0o600 });
      console.log(`The secret is in ${file}. Set it as QUALITY_WEBHOOK_SECRET in Cencori's environment, then delete the file.`);
    } else {
      console.log('Quality gave no new secret (the webhook was already registered). Use --rotate for a new one.');
    }
  } else if (command === 'show') {
    const said = await call('GET', '');
    console.log(`Events go to ${String(said.url)} (${JSON.stringify(said.events ?? [])}).`);
  } else if (command === 'test') {
    await call('POST', '/test');
    console.log('Quality sent a test event.');
  } else {
    console.error('Usage: quality-webhook.ts register --out <file> [--rotate] [--url <url>] | show | test');
    process.exit(2);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
