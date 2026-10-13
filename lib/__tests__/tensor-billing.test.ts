import { describe, expect, it } from "vitest";
import {
  tensorCheckoutReference,
  effectiveTensorPlan,
  legacyTensorPlanCode,
  paystackChannels,
  majorAmountToMinor,
  parseTensorCheckoutInput,
  resolveTensorCheckoutOrigin,
} from "@/lib/tensor-billing";

describe("Tensor billing contracts", () => {
  it("sells Starter, Builder and Pro, and nothing else", () => {
    expect(
      parseTensorCheckoutInput({
        plan: "builder",
        provider: "paystack",
        paymentMethod: "opay",
      }),
    ).toEqual({ plan: "builder", provider: "paystack", paymentMethod: "opay" });
    expect(parseTensorCheckoutInput({ plan: "starter", provider: "bachs" })).toEqual({
      plan: "starter",
      provider: "bachs",
      paymentMethod: "auto",
    });
    // There is no free plan to check out, and the trial is not for sale.
    expect(parseTensorCheckoutInput({ plan: "free", provider: "paystack" })).toBeNull();
    expect(parseTensorCheckoutInput({ plan: "enterprise", provider: "paystack" })).toBeNull();
    expect(
      parseTensorCheckoutInput({ plan: "pro", provider: "bachs", paymentMethod: "opay" }),
    ).toBeNull();
  });

  it("still reads a plans page that calls the pass a pack", () => {
    expect(parseTensorCheckoutInput({ pack: "starter", provider: "paystack" })).toEqual({
      plan: "starter",
      provider: "paystack",
      paymentMethod: "auto",
    });
  });

  it("never sets a purchase up to renew", () => {
    expect(
      parseTensorCheckoutInput({ plan: "pro", provider: "paystack", recurring: true }),
    ).toEqual({ plan: "pro", provider: "paystack", paymentMethod: "auto" });
  });

  it("reports Starter to released desktop builds under the code they accept", () => {
    expect(legacyTensorPlanCode("starter")).toBe("free");
    expect(legacyTensorPlanCode("free")).toBe("free");
    expect(legacyTensorPlanCode("builder")).toBe("builder");
    expect(legacyTensorPlanCode("pro")).toBe("pro");
  });

  it("uses the Nigerian checkout channels requested for Paystack", () => {
    expect(paystackChannels("opay")).toEqual(["bank"]);
    expect(paystackChannels("banktransfer")).toEqual(["bank_transfer"]);
    expect(paystackChannels("auto")).toBeUndefined();
  });

  it("converts provider major-unit amounts without floating point drift", () => {
    expect(majorAmountToMinor("5000")).toBe(500_000);
    expect(majorAmountToMinor(15)).toBe(1_500);
    expect(majorAmountToMinor(0)).toBeNull();
    expect(majorAmountToMinor("not-money")).toBeNull();
  });

  it("falls back to the trial when a pass is inactive or has ended", () => {
    const future = new Date("2026-09-30T00:00:00Z").toISOString();
    const past = new Date("2026-08-01T00:00:00Z").toISOString();
    const now = new Date("2026-08-31T00:00:00Z");
    expect(
      effectiveTensorPlan(
        { plan_code: "pro", status: "active", entitlement_ends_at: future },
        now,
      ),
    ).toBe("pro");
    expect(
      effectiveTensorPlan(
        { plan_code: "pro", status: "active", entitlement_ends_at: past },
        now,
      ),
    ).toBe("free");
    expect(
      effectiveTensorPlan(
        { plan_code: "builder", status: "past_due", entitlement_ends_at: future },
        now,
      ),
    ).toBe("free");
    expect(
      effectiveTensorPlan(
        { plan_code: "starter", status: "active", entitlement_ends_at: future },
        now,
      ),
    ).toBe("starter");
  });

  it("creates provider-safe checkout references", () => {
    expect(tensorCheckoutReference("d8b6c53e-1fcb-44e1-b6f7-23aa19c6a3c1")).toBe(
      "tensor-d8b6c53e1fcb44e1b6f723aa19c6a3c1",
    );
  });

  it("always returns production checkouts to cencori.com", () => {
    expect(resolveTensorCheckoutOrigin("https://cencori.vercel.app", "production")).toBe(
      "https://cencori.com",
    );
    expect(
      resolveTensorCheckoutOrigin("https://cencori-feature.vercel.app", "preview"),
    ).toBe("https://cencori-feature.vercel.app");
  });
});
