import type { createAdminClient } from '@/lib/supabaseAdmin';
import {
  getBillingInterval,
  getProductTypeFromId,
  type BachsCharge,
  type BachsPayin,
} from '@/lib/bachsClient';
import { CREDIT_NGN_PER_USD } from '@/lib/billing/credit-pricing';

/**
 * Cencori's revenue ledger (public.payments, database/brimble/0700): one row
 * per successful payment, written after the payment is verified. Recording is
 * idempotent on (provider, provider_payment_id), so a retried webhook or a
 * re-run backfill updates the same row.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

const PAID_STATUSES = new Set(['succeeded', 'successful', 'paid', 'completed']);

/** Naira credit packs sold at ₦1,000 per $1 until the 2026-11-07 repricing. */
const NGN_REPRICED_AT = Date.parse('2026-11-07T00:00:00Z');
const NGN_PER_USD_BEFORE_REPRICE = 1_000;

export function ngnPerUsdAt(paidAt: Date): number {
  return paidAt.getTime() < NGN_REPRICED_AT ? NGN_PER_USD_BEFORE_REPRICE : CREDIT_NGN_PER_USD;
}

export function isPaidStatus(status: string | null | undefined): boolean {
  return PAID_STATUSES.has(String(status ?? '').toLowerCase());
}

function money(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface PaymentRow {
  provider: 'bachs' | 'coincircuit';
  provider_payment_id: string;
  organization_id: string | null;
  product_type: string;
  product_id: string | null;
  billing_interval: 'month' | 'year' | null;
  amount: number;
  currency: string;
  amount_usd: number;
  fx_ngn_per_usd: number | null;
  processing_fee: number | null;
  settlement_amount: number | null;
  settlement_currency: string | null;
  payment_method: string | null;
  customer_email: string | null;
  paid_at: string;
}

/** Map a verified Bachs charge (or a listed payin) to a ledger row. Null when it isn't a paid charge. */
export function bachsPaymentRow(charge: BachsCharge | BachsPayin): PaymentRow | null {
  const chargeId = 'charge_id' in charge && charge.charge_id ? charge.charge_id : ('id' in charge ? charge.id : null);
  if (!chargeId || !isPaidStatus(charge.status)) return null;

  const amount = money(charge.amount);
  if (amount === null || amount < 0) return null;

  const currency = String(charge.currency || 'USD').toUpperCase();
  const paidAt = new Date(charge.created_at || Date.now());
  const productId = charge.product_cart?.[0]?.product_id ?? null;
  // Pro paid in naira is a plan payment: count it with subscriptions (MRR).
  const nairaPlan = charge.metadata?.purchase_type === 'plan_pass_ngn';
  const productType = nairaPlan
    ? 'subscription'
    : charge.metadata?.purchase_type
      || (productId ? getProductTypeFromId(productId) : null)
      || 'other';
  const metadataInterval = charge.metadata?.interval;
  const fx = currency === 'NGN' ? ngnPerUsdAt(paidAt) : null;
  const full = charge as Partial<BachsCharge>;

  return {
    provider: 'bachs',
    provider_payment_id: chargeId,
    organization_id: charge.metadata?.org_id || null,
    product_type: productType,
    product_id: productId,
    billing_interval: nairaPlan
      ? (metadataInterval === 'year' || metadataInterval === 'month' ? metadataInterval : null)
      : productId ? getBillingInterval(productId) : null,
    amount,
    currency,
    amount_usd: Math.round((fx ? amount / fx : amount) * 100) / 100,
    fx_ngn_per_usd: fx,
    processing_fee: money(full.processing_fee),
    settlement_amount: money(full.settlement_amount),
    settlement_currency: full.settlement_currency ?? null,
    payment_method: full.payment_method ?? null,
    customer_email: charge.customer?.email ?? null,
    paid_at: paidAt.toISOString(),
  };
}

/** Upsert ledger rows. Throws on database errors so callers decide whether that's fatal. */
export async function recordPayments(supabase: AdminClient, rows: PaymentRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  // An org id from metadata may point at an org that was since deleted; the
  // foreign key would reject the whole batch, so keep the payment, drop the link.
  const orgIds = [...new Set(rows.map((row) => row.organization_id).filter(Boolean))] as string[];
  const known = new Set<string>();
  if (orgIds.length > 0) {
    const { data, error } = await supabase.from('organizations').select('id').in('id', orgIds);
    if (error) throw error;
    for (const org of data ?? []) known.add(org.id);
  }
  const clean = rows.map((row) => ({
    ...row,
    organization_id: row.organization_id && known.has(row.organization_id) ? row.organization_id : null,
  }));
  const { error } = await supabase
    .from('payments')
    .upsert(clean, { onConflict: 'provider,provider_payment_id' });
  if (error) throw error;
  return clean.length;
}

/**
 * Record a payment from a webhook without ever failing the webhook: the
 * credit or plan has already been granted, and the backfill can fill a gap.
 */
export async function recordPaymentSafely(supabase: AdminClient, row: PaymentRow | null, source: string) {
  if (!row) return;
  try {
    await recordPayments(supabase, [row]);
  } catch (error) {
    console.error(`[Payments ledger] ${source}: failed to record ${row.provider_payment_id}`, error);
  }
}
