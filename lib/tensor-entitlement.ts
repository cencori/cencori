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

export type TensorModelPolicy = "auto" | "open_weight" | "frontier" | "custom";

/** Who a proxied Tensor call is for, and the model class their plan allows. */
export const TENSOR_USER_HEADER = "x-tensor-user-id";
export const TENSOR_MODEL_POLICY_HEADER = "x-tensor-model-policy";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sameSecret(left: string, right: string): boolean {
  // Length is not secret here, and comparing every character keeps the time independent of where
  // two keys first differ.
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

/**
 * The Tensor user a gateway call was made for, when it arrived through Tensor's own proxy.
 *
 * Every Tensor user's calls reach the gateway under one product key, so the key no longer says
 * whose task a call belongs to — and without that its cost was charged to nobody, which is how an
 * account could run far past its allowance. The proxy has already authenticated the user and
 * checked their plan; it names them here, and the gateway records the cost against them.
 *
 * The headers are believed only on the product key itself. That key never leaves the server, so
 * nothing outside the proxy can present it, and a customer's own key naming a Tensor user is
 * ignored.
 */
export function readProxiedTensorTurn(
  headers: Headers,
  apiKey: string,
  productKey: string | undefined = process.env.BASECODE_GATEWAY_API_KEY?.trim(),
): { userId: string; modelPolicy: TensorModelPolicy } | null {
  if (!productKey || !sameSecret(apiKey, productKey)) return null;
  const userId = headers.get(TENSOR_USER_HEADER)?.trim() ?? "";
  if (!UUID.test(userId)) return null;
  const policy = headers.get(TENSOR_MODEL_POLICY_HEADER);
  if (policy !== "auto" && policy !== "open_weight" && policy !== "frontier" && policy !== "custom") {
    return null;
  }
  return { userId, modelPolicy: policy };
}
