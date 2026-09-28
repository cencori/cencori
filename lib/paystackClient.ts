import { createHmac, timingSafeEqual } from "node:crypto";

const PAYSTACK_API_BASE = process.env.PAYSTACK_API_BASE || "https://api.paystack.co";

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("Missing PAYSTACK_SECRET_KEY environment variable");
  return key;
}

async function paystackFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${PAYSTACK_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    signal: options.signal ?? AbortSignal.timeout(15_000),
  });
  const payload = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !payload) {
    throw new Error(`Paystack API error ${response.status}`);
  }
  return payload;
}

export type PaystackInitializeInput = {
  email: string;
  /** Amount in kobo (the NGN minor unit) — the same minor units the plans table stores. */
  amountMinor: number;
  /** Paystack-safe reference: only `-`, `.`, `=` and alphanumerics are allowed. */
  reference: string;
  callbackUrl: string;
  currency: "NGN";
  /** Omitted for the full channel list. OPay is reached through the `bank`
   *  (Pay with Bank) channel — the customer picks OPay on the Paystack checkout
   *  and authorizes in the OPay app. */
  channels?: string[];
  /** Subscribes the customer to a Paystack plan after the first payment.
   *  Overrides `amountMinor` — the plan amount is charged instead. */
  plan?: string;
  metadata: Record<string, string>;
};

export type PaystackInitializeResponse = {
  status: boolean;
  message: string;
  data: { authorization_url: string; access_code: string; reference: string };
};

export type PaystackVerifiedTransaction = {
  id: number;
  status: string;
  reference: string;
  amount: number;
  currency: string;
  channel?: string;
  paid_at?: string;
  customer?: { id?: number; customer_code?: string; email?: string };
};

export type PaystackSubscription = {
  subscription_code: string;
  email_token: string;
  status: string;
  amount: number;
  next_payment_date?: string | null;
  plan?: { plan_code?: string };
  customer?: { id?: number; customer_code?: string; email?: string };
};

export async function initializePaystackTransaction(
  input: PaystackInitializeInput,
): Promise<PaystackInitializeResponse> {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error("Invalid Paystack transaction amount");
  }
  const response = await paystackFetch<PaystackInitializeResponse>(
    "/transaction/initialize",
    {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        amount: input.amountMinor,
        reference: input.reference,
        callback_url: input.callbackUrl,
        currency: input.currency,
        ...(input.channels ? { channels: input.channels } : {}),
        ...(input.plan ? { plan: input.plan } : {}),
        metadata: input.metadata,
      }),
    },
  );
  if (!response.status || !response.data?.authorization_url) {
    throw new Error("Paystack did not return a checkout URL");
  }
  return response;
}

export async function verifyPaystackTransaction(
  reference: string,
): Promise<PaystackVerifiedTransaction> {
  if (!reference || reference.length > 200) {
    throw new Error("Invalid Paystack transaction reference");
  }
  const response = await paystackFetch<{
    status: boolean;
    data: PaystackVerifiedTransaction;
  }>(`/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" });
  if (!response.status || !response.data) {
    throw new Error("Paystack transaction verification failed");
  }
  return response.data;
}

export async function listPaystackSubscriptions(
  customerId: number,
): Promise<PaystackSubscription[]> {
  if (!Number.isSafeInteger(customerId) || customerId <= 0) {
    throw new Error("Invalid Paystack customer ID");
  }
  const response = await paystackFetch<{
    status: boolean;
    data: PaystackSubscription[];
  }>(`/subscription?customer=${customerId}&perPage=50`, { method: "GET" });
  if (!response.status || !Array.isArray(response.data)) {
    throw new Error("Paystack subscription lookup failed");
  }
  return response.data;
}

/**
 * Turns auto-renew off. Paystack stops future charges; the current period runs
 * to its end. Needs the email_token captured at subscription creation.
 */
export async function disablePaystackSubscription(code: string, token: string): Promise<void> {
  if (!code || !token) throw new Error("Invalid Paystack subscription");
  const response = await paystackFetch<{ status: boolean; message: string }>(
    "/subscription/disable",
    { method: "POST", body: JSON.stringify({ code, token }) },
  );
  if (!response.status) {
    throw new Error(`Paystack could not disable the subscription: ${response.message}`);
  }
}

/**
 * Paystack signs webhooks with HMAC-SHA512 over the raw body, hex-encoded in the
 * `x-paystack-signature` header, using the same secret key as API calls.
 */
export function verifyPaystackWebhook(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const computed = createHmac("sha512", getSecretKey()).update(rawBody).digest("hex");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(computed);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
