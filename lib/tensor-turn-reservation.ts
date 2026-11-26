import "server-only";

import { invalidateTensorAccess, setCachedTensorAccess } from "@/lib/config-cache";
import type { createAdminClient } from "@/lib/supabaseAdmin";
import { gatewayEntitlementFrom } from "@/lib/tensor-entitlement";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Cencori serves a turn's model calls only while the account has a usage reservation open:
 * opened before the turn starts, closed when it ends. One turn at a time per account. The desktop
 * app and the web reserve through app/api/tensor/billing/turn; Cencori's own turns, run with no
 * page open (lib/tensor-background-turn.ts), call these directly.
 */
export type TurnReservation = { allowed?: boolean; reason?: string } & Record<string, unknown>;

/** Opens a reservation; `allowed` says whether the turn may start, `reason` why not. */
export async function reserveTensorTurn(
  admin: Admin,
  userId: string,
  clientTurnKey: string,
  model: string | null,
): Promise<TurnReservation> {
  const { data, error } = await admin.rpc("basecode_reserve_turn", {
    p_user_id: userId,
    p_client_turn_key: clientTurnKey,
    p_model: model ? model.slice(0, 160) : null,
  });
  if (error) throw error;
  const result = (data as TurnReservation | null) ?? { allowed: false };
  // The turn's first model call re-checks entitlement before it dispatches, and the cache it
  // reads was cleared when the previous turn finished — so every turn paid that lookup
  // (0.8–1.7s) right after this one had just answered it. Seeded here instead, awaited so the
  // entry exists before the turn starts. Only an answer with every field the lookup returns is
  // cached: the plan's model policy rides on it, and a partial entry would skip it.
  const entitlement = gatewayEntitlementFrom(result);
  if (entitlement) await setCachedTensorAccess(userId, entitlement);
  return result;
}

/** Closes a reservation; safe for one that is already closed. */
export async function finishTensorTurn(
  admin: Admin,
  userId: string,
  clientTurnKey: string,
  runtimeTurnId: string | null,
): Promise<boolean> {
  const { data, error } = await admin.rpc("basecode_finish_turn", {
    p_user_id: userId,
    p_client_turn_key: clientTurnKey,
    p_runtime_turn_id: runtimeTurnId ? runtimeTurnId.slice(0, 200) : null,
  });
  await invalidateTensorAccess(userId);
  if (error) throw error;
  return data === true;
}
