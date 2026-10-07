/**
 * The reservation's answer in the shape `basecode_gateway_access` returns, or null when it is not
 * an allowed answer carrying all of it. The two read the same account, plan, and the reservation
 * this call just made, so they agree for as long as the cache lives.
 */
export function gatewayEntitlementFrom(result: unknown): {
  allowed: true;
  model_policy: string;
  plan: string;
  reservation_id: string;
  reset_at: string | null;
} | null {
  if (!result || typeof result !== "object") return null;
  const value = result as Record<string, unknown>;
  if (value.allowed !== true) return null;
  if (typeof value.reservation_id !== "string" || !value.reservation_id) return null;
  if (typeof value.plan !== "string" || !value.plan) return null;
  if (typeof value.model_policy !== "string" || !value.model_policy) return null;
  return {
    allowed: true,
    model_policy: value.model_policy,
    plan: value.plan,
    reservation_id: value.reservation_id,
    reset_at: typeof value.reset_at === "string" ? value.reset_at : null,
  };
}
