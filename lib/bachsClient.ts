import { createHmac, timingSafeEqual } from 'node:crypto';
import { CARD_TOPUP_FEE_PERCENT, CREDIT_NGN_PER_USD, netTopupCredits } from '@/lib/billing/credit-pricing';

const BACHS_API_BASE =
  process.env.BACHS_API_BASE ||
  (process.env.NODE_ENV === 'production'
    ? 'https://api.bachs.io/v1'
    : 'https://sandbox-api.bachs.io/v1');

function getApiKey(): string {
  const key = process.env.BACHS_API_KEY;
  if (!key) throw new Error('Missing BACHS_API_KEY environment variable');
  return key;
}

export function getWebhookSecret(): string {
  const secret = process.env.BACHS_WEBHOOK_SECRET;
  if (!secret) throw new Error('Missing BACHS_WEBHOOK_SECRET environment variable');
  return secret;
}

/* ─── Types ───────────────────────────────────────────────────────────── */

export type BachsProductType =
  | 'subscription'
  | 'credits_topup'
  | 'basecode_subscription'
  | 'business_pass';
export type SubscriptionTier = 'pro' | 'team';
export type BillingInterval = 'month' | 'year';

/** A new customer by email and name, or an existing one by id (required for recurring products). */
export type BachsCustomerInput =
  | { email: string; name: string }
  | { customer_id: string };

export interface BachsBillingAddress {
  line1: string;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  /** ISO 3166-1 alpha-2. */
  country: string;
}

export interface BachsCustomerRecord {
  customer_id: string;
  email: string;
  name?: string | null;
  metadata?: Record<string, string> | null;
  billing_address?: BachsBillingAddress | null;
  created_at: string;
  updated_at?: string;
}

export interface BachsProduct {
  id: string;
  name: string;
  status?: string;
  price: { currency: string; price_type: string; amount: string | null } | null;
  billing_cycle: { interval: 'day' | 'week' | 'month' | 'year'; frequency: number } | null;
}

export interface BachsProductCartItem {
  product_id: string;
  quantity: number;
}

/** Product-less checkout price: the buyer pays exactly `amount` in `currency`. */
export interface BachsCheckoutPricing {
  currency: string;
  price_type: 'fixed';
  /** Decimal string in major units, e.g. "15000.00". */
  amount: string;
}

export interface CreateCheckoutSessionInput {
  /** Catalog products. Exactly one of `product_cart` and `pricing` is sent. */
  product_cart?: BachsProductCartItem[];
  pricing?: BachsCheckoutPricing;
  customer: BachsCustomerInput;
  success_url: string;
  cancel_url: string;
  metadata?: Record<string, string>;
  reference?: string;
  expires_in_minutes?: number;
  /** The currency the customer pays in, e.g. NGN. */
  billing_currency?: string;
  /** Keep the card for later charges (subscriptions save it regardless). */
  save_payment_method?: boolean;
}

export interface BachsCheckoutSession {
  checkout_id: string;
  checkout_url: string;
  status: string;
  expires_at: string;
  created_at: string;
  reference?: string;
}

export interface BachsCustomer {
  id: string;
  email: string;
  name?: string;
  created_at: string;
}

export interface BachsCharge {
  charge_id: string;
  checkout_id: string;
  reference: string;
  status: string;
  amount: string;
  currency: string;
  settlement_amount?: string;
  settlement_currency?: string;
  payment_method?: string;
  processing_fee?: string;
  customer: BachsCustomer;
  product_cart: BachsProductCartItem[];
  metadata: Record<string, string>;
  created_at: string;
}

export interface BachsWebhookCustomer {
  id: string;
  email: string;
  name?: string;
}

export interface BachsCollectionData {
  charge_id: string | null;
  checkout_id: string | null;
  reference: string | null;
  status: string;
  amount: string;
  currency: string;
  settlement_amount?: string;
  settlement_currency?: string;
  payment_method?: string;
  processing_fee?: string | null;
  product_cart: BachsProductCartItem[] | null;
  customer: BachsWebhookCustomer;
  metadata: Record<string, string>;
  reason?: string;
}

export interface BachsSubscriptionData {
  subscription_id: string;
  customer: {
    customer_id: string;
    email: string;
    name?: string;
  };
  product_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'unpaid' | 'canceled' | 'paused';
  collection_method: string;
  currency: string;
  amount: string;
  billing_cycle: {
    interval: 'day' | 'week' | 'month' | 'year';
    frequency: number;
  };
  quantity: number;
  current_period_start: string;
  current_period_end: string;
  next_billed_at: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  created_at: string;
  items: unknown[];
  metadata: Record<string, string>;
}

/** invoice.created / invoice.paid / invoice.payment_failed: one subscription period's bill. */
export interface BachsInvoiceData {
  invoice_id: string;
  subscription: { subscription_id: string } | null;
  customer: { customer_id: string; email?: string; name?: string };
  charge: string | null;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  currency: string;
  total: string;
  amount_paid: string;
  period_start: string | null;
  period_end: string | null;
  attempt_count?: number;
  next_payment_attempt?: string | null;
  created_at: string;
  metadata: Record<string, string> | null;
}

type BachsWebhookEnvelope = {
  id: string;
  created_at: string;
  organization_id: string;
};

export type BachsWebhookEvent = BachsWebhookEnvelope & (
  | {
      type:
        | 'collection.succeeded'
        | 'collection.failed'
        | 'collection.abandoned'
        | 'collection.underpaid';
      data: BachsCollectionData;
    }
  | {
      type:
        | 'customer.subscription.created'
        | 'customer.subscription.updated'
        | 'customer.subscription.deleted';
      data: BachsSubscriptionData;
    }
  | {
      type: 'invoice.created' | 'invoice.paid' | 'invoice.payment_failed';
      data: BachsInvoiceData;
    }
);

export interface BachsPayin {
  id: string;
  charge_id?: string;
  amount: string;
  currency: string;
  status: string;
  customer: BachsCustomer;
  product_cart?: BachsProductCartItem[];
  metadata?: Record<string, string>;
  created_at: string;
}

export interface BachsPayinResponse {
  payins: BachsPayin[];
  total_count: number;
  page: number;
  per_page: number;
}

/* ─── API Client ──────────────────────────────────────────────────────── */

async function bachsFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BACHS_API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Bachs API error ${res.status}${body ? `: ${body}` : ''}`);
  }
  return res.json();
}

/**
 * Bachs rejects localhost return URLs, so a checkout opened from local dev
 * returns to the same path on the public site (console.localhost →
 * console.cencori.com, localhost → cencori.com). The webhook grants the
 * purchase either way; only where the browser lands afterwards changes.
 */
function publicReturnUrl(value: string): string {
  try {
    const url = new URL(value);
    const host = url.hostname;
    const local = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
    if (!local && !host.endsWith('.localhost')) return value;
    const sub = host.endsWith('.localhost') ? host.slice(0, -'.localhost'.length) : '';
    return `https://${sub ? `${sub}.` : ''}cencori.com${url.pathname}${url.search}${url.hash}`;
  } catch {
    return value;
  }
}

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput
): Promise<BachsCheckoutSession> {
  return bachsFetch<BachsCheckoutSession>('/checkout-sessions', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      success_url: publicReturnUrl(input.success_url),
      cancel_url: publicReturnUrl(input.cancel_url),
    }),
  });
}

export async function getCharge(chargeId: string): Promise<BachsCharge> {
  return bachsFetch<BachsCharge>(`/payments/charges/${chargeId}`);
}

export async function createCustomer(input: {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
  billing_address?: BachsBillingAddress;
}): Promise<BachsCustomerRecord> {
  return bachsFetch<BachsCustomerRecord>('/customers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Only the fields sent change, except billing_address, which replaces the
 * whole address (null clears it; leave it out to keep it).
 */
export async function updateCustomer(
  customerId: string,
  input: {
    email?: string;
    name?: string;
    metadata?: Record<string, string>;
    billing_address?: BachsBillingAddress | null;
  },
): Promise<BachsCustomerRecord> {
  return bachsFetch<BachsCustomerRecord>(`/customers/${encodeURIComponent(customerId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/**
 * A link to the Bachs customer portal, where the customer manages their
 * subscription, cards and invoices. What they can do there, and where it
 * returns to, are portal settings in the Bachs dashboard.
 */
export async function createPortalSession(customerId: string): Promise<{ id: string; url: string }> {
  return bachsFetch<{ id: string; url: string }>(
    `/customers/${encodeURIComponent(customerId)}/portal-sessions`,
    { method: 'POST' },
  );
}

export async function getProduct(productId: string): Promise<BachsProduct> {
  return bachsFetch<BachsProduct>(`/products/${encodeURIComponent(productId)}`);
}

export async function listPayins(params?: {
  customer_id?: string;
  page?: number;
  per_page?: number;
}): Promise<BachsPayinResponse> {
  const searchParams = new URLSearchParams();
  if (params?.customer_id) searchParams.set('customer_id', params.customer_id);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.per_page) searchParams.set('per_page', String(params.per_page));
  const query = searchParams.toString();
  return bachsFetch<BachsPayinResponse>(
    `/payments/payins${query ? `?${query}` : ''}`
  );
}

/* ─── Webhook Signature Verification ─────────────────────────────────── */

export function verifyBachsWebhook(
  rawBody: string,
  timestampHeader: string,
  signatureHeader: string
): BachsWebhookEvent {
  const secret = getWebhookSecret();

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestampHeader, 10)) > 300) {
    throw new Error('Webhook timestamp outside tolerance window');
  }

  const payload = `${timestampHeader}.${rawBody}`;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');

  const sig = Buffer.from(signatureHeader, 'hex');
  const exp = Buffer.from(expected, 'hex');

  if (sig.length !== exp.length) {
    throw new Error('Invalid webhook signature');
  }

  if (!timingSafeEqual(sig, exp)) {
    throw new Error('Invalid webhook signature');
  }

  return JSON.parse(rawBody);
}

/* ─── Product Configuration ───────────────────────────────────────────── */

export const BACHS_CONFIG = {
  products: {
    proMonthly: process.env.BACHS_PRODUCT_PRO_MONTHLY || '',
    proAnnual: process.env.BACHS_PRODUCT_PRO_ANNUAL || '',
    teamMonthly: process.env.BACHS_PRODUCT_TEAM_MONTHLY || '',
    teamAnnual: process.env.BACHS_PRODUCT_TEAM_ANNUAL || '',
    creditsStarter: process.env.BACHS_PRODUCT_CREDITS_STARTER || '',
    creditsGrowth: process.env.BACHS_PRODUCT_CREDITS_GROWTH || '',
    creditsScale: process.env.BACHS_PRODUCT_CREDITS_SCALE || '',
    tensorStarterMonthly: process.env.BACHS_PRODUCT_BASECODE_STARTER_MONTHLY || '',
    tensorBuilderMonthly: process.env.BACHS_PRODUCT_BASECODE_BUILDER_MONTHLY || '',
    tensorProMonthly: process.env.BACHS_PRODUCT_BASECODE_PRO_MONTHLY || '',
    // Business plans, as 30-day naira passes until Bachs enables NGN subscriptions.
    businessStarter: process.env.BACHS_PRODUCT_BUSINESS_STARTER || '',
    businessGrowth: process.env.BACHS_PRODUCT_BUSINESS_GROWTH || '',
    businessBusiness: process.env.BACHS_PRODUCT_BUSINESS_BUSINESS || '',
  } as const,
} as const;

// price = US cents; ngnPrice = kobo. ngnPrice must match the NGN currency
// option on the Bachs product, or naira checkouts fail verification. Change
// the Bachs price first (PATCH /v1/products/{id} price.currency_options),
// then this: a minimum above what Bachs charges rejects paid checkouts.
const ngnKobo = (usd: number) => usd * CREDIT_NGN_PER_USD * 100;

export const CREDIT_TOPUP_PACKS = [
  { label: 'Starter', credits: 10, price: 1000, ngnPrice: ngnKobo(10), productId: BACHS_CONFIG.products.creditsStarter },
  { label: 'Growth', credits: 50, price: 5000, ngnPrice: ngnKobo(50), productId: BACHS_CONFIG.products.creditsGrowth },
  { label: 'Scale', credits: 200, price: 20000, ngnPrice: ngnKobo(200), productId: BACHS_CONFIG.products.creditsScale },
] as const;

export { CREDIT_NGN_PER_USD };

/* ─── Product Billing Interval Lookup ─────────────────────────────────── */

const PRODUCT_BILLING_INTERVAL: Record<string, BillingInterval> = {};

function initProductBillingInterval() {
  const p = BACHS_CONFIG.products;
  if (p.proMonthly) PRODUCT_BILLING_INTERVAL[p.proMonthly] = 'month';
  if (p.proAnnual) PRODUCT_BILLING_INTERVAL[p.proAnnual] = 'year';
  if (p.teamMonthly) PRODUCT_BILLING_INTERVAL[p.teamMonthly] = 'month';
  if (p.teamAnnual) PRODUCT_BILLING_INTERVAL[p.teamAnnual] = 'year';
}

let _intervalInit = false;
function ensureIntervalInit() {
  if (!_intervalInit) {
    initProductBillingInterval();
    _intervalInit = true;
  }
}

/* ─── Product → Tier Type Lookup ──────────────────────────────────────── */

const PRODUCT_TIER: Record<string, SubscriptionTier> = {};

function initProductTier() {
  const p = BACHS_CONFIG.products;
  if (p.proMonthly) PRODUCT_TIER[p.proMonthly] = 'pro';
  if (p.proAnnual) PRODUCT_TIER[p.proAnnual] = 'pro';
  if (p.teamMonthly) PRODUCT_TIER[p.teamMonthly] = 'team';
  if (p.teamAnnual) PRODUCT_TIER[p.teamAnnual] = 'team';
}

let _tierInit = false;
function ensureTierInit() {
  if (!_tierInit) {
    initProductTier();
    _tierInit = true;
  }
}

export function getTensorProductId(tier: 'starter' | 'builder' | 'pro'): string {
  const id =
    tier === 'starter'
      ? BACHS_CONFIG.products.tensorStarterMonthly
      : tier === 'builder'
        ? BACHS_CONFIG.products.tensorBuilderMonthly
        : BACHS_CONFIG.products.tensorProMonthly;
  if (!id) throw new Error(`No Bachs Tensor product configured for ${tier}`);
  return id;
}

export function getTensorPlanByProductId(
  productId: string
): 'starter' | 'builder' | 'pro' | null {
  if (!productId) return null;
  if (productId === BACHS_CONFIG.products.tensorStarterMonthly) return 'starter';
  if (productId === BACHS_CONFIG.products.tensorBuilderMonthly) return 'builder';
  if (productId === BACHS_CONFIG.products.tensorProMonthly) return 'pro';
  return null;
}

/** The business plan a 30-day pass product buys. */
export function getBusinessPlanByProductId(
  productId: string
): 'starter' | 'growth' | 'business' | null {
  const p = BACHS_CONFIG.products;
  if (!productId) return null;
  if (productId === p.businessStarter) return 'starter';
  if (productId === p.businessGrowth) return 'growth';
  if (productId === p.businessBusiness) return 'business';
  return null;
}

export function getBusinessPassProductId(plan: 'starter' | 'growth' | 'business'): string {
  const p = BACHS_CONFIG.products;
  const id = plan === 'starter' ? p.businessStarter : plan === 'growth' ? p.businessGrowth : p.businessBusiness;
  if (!id) throw new Error(`No Bachs product configured for the ${plan} business plan`);
  return id;
}

export function getSubscriptionTierFromProductId(
  productId: string
): SubscriptionTier | null {
  ensureTierInit();
  return PRODUCT_TIER[productId] || null;
}

export function getCreditTopupPackConfig(productId: string) {
  return CREDIT_TOPUP_PACKS.find((p) => p.productId === productId) || null;
}

export function getCreditTopupCreditsByProductId(
  productId: string
): number | null {
  const pack = getCreditTopupPackConfig(productId);
  return pack ? pack.credits : null;
}

export function netCreditsAfterFee(grossCredits: number): number {
  return netTopupCredits(grossCredits, CARD_TOPUP_FEE_PERCENT);
}

export function getBillingInterval(
  productId: string
): BillingInterval | null {
  ensureIntervalInit();
  return PRODUCT_BILLING_INTERVAL[productId] || null;
}

export function getProductTypeFromId(
  productId: string
): BachsProductType | null {
  const p = BACHS_CONFIG.products;
  if (
    productId === p.proMonthly ||
    productId === p.proAnnual ||
    productId === p.teamMonthly ||
    productId === p.teamAnnual
  ) {
    return 'subscription';
  }
  if (
    productId === p.creditsStarter ||
    productId === p.creditsGrowth ||
    productId === p.creditsScale
  ) {
    return 'credits_topup';
  }
  if (
    (p.tensorStarterMonthly !== '' && productId === p.tensorStarterMonthly) ||
    productId === p.tensorBuilderMonthly ||
    productId === p.tensorProMonthly
  ) {
    return 'basecode_subscription';
  }
  if (getBusinessPlanByProductId(productId)) return 'business_pass';
  return null;
}

export function computePeriodEnd(
  interval: BillingInterval,
  from: Date = new Date()
): Date {
  const d = new Date(from);
  if (interval === 'year') {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}
