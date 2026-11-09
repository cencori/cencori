import { createHmac, timingSafeEqual } from 'crypto';
import { CoinCircuit, type components } from 'coincircuit';

type CreateCheckoutSessionDto = components['schemas']['CreateCheckoutSessionDto'];
type CheckoutSessionV2Dto = components['schemas']['CheckoutSessionV2Dto'];
type PaymentCompletedWebhookDto = components['schemas']['PaymentCompletedWebhookDto'];
const apiKey = process.env.COINCIRCUIT_API_KEY || '';
const webhookSecret = process.env.COINCIRCUIT_WEBHOOK_SECRET || '';

let client: CoinCircuit | null = null;

function getClient(): CoinCircuit {
  if (!client) {
    client = new CoinCircuit({
      apiKey,
      baseUrl: process.env.COINCIRCUIT_BASE_URL || 'https://api.coincircuit.io',
      timeout: 30000,
      maxRetries: 2,
    });
  }
  return client;
}

export async function createPaymentSession(
  params: CreateCheckoutSessionDto
): Promise<CheckoutSessionV2Dto> {
  return getClient().payments.create(params);
}

// CoinCircuit signs webhooks as `X-Coincircuit-Signature: v1=<hex>` with
// HMAC-SHA256 over `${X-Coincircuit-Timestamp}.${rawBody}`. Older deliveries
// (and one of their migration guides) sign the bare body with a bare hex
// signature, so both are accepted. Grants are idempotent on the payment
// reference, so the timestamp window only needs to bound replays loosely
// while still covering CoinCircuit's retry schedule and manual redeliveries.
const SIGNATURE_MAX_AGE_SECONDS = 72 * 60 * 60;

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null = null,
): boolean {
  if (!webhookSecret) {
    console.error('[CoinCircuit] Missing webhook secret');
    return false;
  }

  if (!signatureHeader) {
    console.error('[CoinCircuit] Missing signature header');
    return false;
  }

  try {
    const candidates = signatureHeader
      .split(',')
      .map((part) => part.trim().replace(/^v1=/i, '').toLowerCase())
      .filter(Boolean);
    if (candidates.length === 0) return false;

    const sign = (payload: string) =>
      createHmac('sha256', webhookSecret).update(payload).digest('hex');

    const timestamp = timestampHeader?.trim();
    if (timestamp) {
      const ts = Number(timestamp);
      const age = Math.floor(Date.now() / 1000) - ts;
      if (Number.isFinite(ts) && age <= SIGNATURE_MAX_AGE_SECONDS && age >= -300) {
        const expected = sign(`${timestamp}.${rawBody}`);
        if (candidates.some((c) => safeEqualHex(c, expected))) return true;
      } else {
        console.error('[CoinCircuit] Webhook timestamp outside tolerance:', timestamp);
      }
    }

    const legacy = sign(rawBody);
    return candidates.some((c) => safeEqualHex(c, legacy));
  } catch (err) {
    console.error('[CoinCircuit] HMAC verification error:', err);
    return false;
  }
}

export type CoinCircuitWebhookPayload = PaymentCompletedWebhookDto;
