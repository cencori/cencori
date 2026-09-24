import type { createAdminClient } from '@/lib/supabaseAdmin';
import { invalidateCreditsBalance } from '@/lib/config-cache';

type AdminClient = ReturnType<typeof createAdminClient>;

/** Apply a verified payment to the USD wallet once, atomically with its audit row. */
export async function applyPaidCreditTopup(params: {
  supabase: AdminClient;
  provider: 'bachs' | 'coincircuit';
  paymentReference: string;
  organizationId: string;
  amountUsd: number;
  metadata?: Record<string, unknown>;
}): Promise<{ applied: boolean; newBalance: number }> {
  if (!params.paymentReference.trim() || !Number.isFinite(params.amountUsd)
      || params.amountUsd <= 0) {
    throw new Error('Invalid paid credit top-up');
  }

  const { data, error } = await params.supabase.rpc('apply_paid_credit_topup', {
    p_provider: params.provider,
    p_payment_reference: params.paymentReference,
    p_organization_id: params.organizationId,
    p_amount: params.amountUsd,
    p_metadata: params.metadata ?? {},
  });

  if (error) throw new Error(`Paid credit top-up failed: ${error.message}`);
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result.applied !== 'boolean'
      || !Number.isFinite(Number(result.new_balance))) {
    throw new Error('Paid credit top-up returned an invalid result');
  }

  await invalidateCreditsBalance(params.organizationId);
  return { applied: result.applied, newBalance: Number(result.new_balance) };
}
