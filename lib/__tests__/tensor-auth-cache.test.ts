/**
 * @vitest-environment node
 *
 * Tensor's per-call login check, and the entitlement a reservation hands the inference proxy.
 * Both sat on the path of every turn as network round trips that answered a question just asked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const getCachedTensorUser = vi.fn();
const setCachedTensorUser = vi.fn();

vi.mock("@/lib/supabaseAdmin", () => ({
  createAdminClient: () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/config-cache", () => ({
  getCachedTensorUser: (...args: unknown[]) => getCachedTensorUser(...args),
  setCachedTensorUser: (...args: unknown[]) => setCachedTensorUser(...args),
}));

const { authenticateTensorDataRequest } = await import("@/lib/tensor-data");
const { gatewayEntitlementFrom } = await import("@/lib/tensor-entitlement");

function tokenExpiringAt(exp: number): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "HS256" })}.${part({ exp, sub: "user-1" })}.signature`;
}

beforeEach(() => {
  getUser.mockReset();
  getCachedTensorUser.mockReset().mockResolvedValue(null);
  setCachedTensorUser.mockReset();
});

describe("the Tensor login check", () => {
  it("asks Supabase once, then remembers the verified user until the token's expiry", async () => {
    const token = tokenExpiringAt(2_000_000_000);
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    const session = await authenticateTensorDataRequest(`Bearer ${token}`);

    expect(session?.user.id).toBe("user-1");
    expect(getUser).toHaveBeenCalledWith(token);
    const [hash, user, expiry] = setCachedTensorUser.mock.calls[0] ?? [];
    // Keyed by a hash: the token itself is never written anywhere.
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(user).toEqual({ id: "user-1" });
    expect(expiry).toBe(2_000_000_000);
  });

  it("skips the round trip when the token was verified moments ago", async () => {
    getCachedTensorUser.mockResolvedValue({ id: "user-1" });

    const session = await authenticateTensorDataRequest(`Bearer ${tokenExpiringAt(2_000_000_000)}`);

    expect(session?.user.id).toBe("user-1");
    expect(getUser).not.toHaveBeenCalled();
  });

  it("remembers nothing about a token Supabase refused", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid JWT") });

    expect(await authenticateTensorDataRequest("Bearer forged")).toBeNull();
    expect(setCachedTensorUser).not.toHaveBeenCalled();
  });
});

describe("the entitlement a reservation hands the proxy", () => {
  const reserved = {
    allowed: true,
    model_policy: "open_weight",
    percentage_used: 12,
    plan: "builder",
    prepaid_balance_microusd: 4_000_000,
    reservation_id: "res-1",
    reset_at: "2026-10-12T00:00:00Z",
  };

  it("is the lookup's own shape, so the proxy cannot tell which one filled the cache", () => {
    expect(gatewayEntitlementFrom(reserved)).toEqual({
      allowed: true,
      model_policy: "open_weight",
      plan: "builder",
      reservation_id: "res-1",
      reset_at: "2026-10-12T00:00:00Z",
    });
  });

  it("is never made from a refusal or from an answer missing the plan's model policy", () => {
    expect(gatewayEntitlementFrom({ allowed: false, reason: "insufficient_credits" })).toBeNull();
    expect(gatewayEntitlementFrom({ ...reserved, model_policy: undefined })).toBeNull();
    expect(gatewayEntitlementFrom({ ...reserved, reservation_id: "" })).toBeNull();
    expect(gatewayEntitlementFrom(null)).toBeNull();
  });
});
