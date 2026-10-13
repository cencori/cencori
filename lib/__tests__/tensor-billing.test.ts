import { describe, expect, it } from "vitest";
import {
  tensorCheckoutReference,
  effectiveTensorPlan,
  legacyTensorPlanCode,
  tensorPlanPriceMinor,
  majorAmountToMinor,
  parseTensorCheckoutInput,
  resolveTensorCheckoutOrigin,
} from "@/lib/tensor-billing";

describe("Tensor billing contracts", () => {
  it("sells Starter, Builder and Pro, and nothing else", () => {
    expect(parseTensorCheckoutInput({ plan: "builder" })).toEqual({ plan: "builder" });
    expect(parseTensorCheckoutInput({ plan: "starter" })).toEqual({ plan: "starter" });
    // There is no free plan to check out, and the trial is not for sale.
    expect(parseTensorCheckoutInput({ plan: "free" })).toBeNull();
    expect(parseTensorCheckoutInput({ plan: "enterprise" })).toBeNull();
    expect(parseTensorCheckoutInput(null)).toBeNull();
  });

  /** A plans page left open from before still names a provider, a method, and a "pack". */
  it("reads an older plans page, and sends it to Bachs like everything else", () => {
    expect(
      parseTensorCheckoutInput({ pack: "starter", provider: "paystack", paymentMethod: "opay" }),
    ).toEqual({ plan: "starter" });
    expect(parseTensorCheckoutInput({ plan: "pro", provider: "paystack", recurring: true })).toEqual({
      plan: "pro",
    });
  });

  it("prices a plan in the currency the payment arrived in", () => {
    const starter = { price_ngn_minor: 200_000, price_usd_minor: 200 };
    expect(tensorPlanPriceMinor(starter, "NGN")).toBe(200_000);
    expect(tensorPlanPriceMinor(starter, "USD")).toBe(200);
    // No price in a currency is not a price of nothing: such a payment cannot buy the plan.
    expect(tensorPlanPriceMinor({ price_ngn_minor: null, price_usd_minor: 200 }, "NGN")).toBeNull();
    expect(tensorPlanPriceMinor({ price_ngn_minor: 0, price_usd_minor: 0 }, "USD")).toBeNull();
  });

  it("reports Starter to released desktop builds under the code they accept", () => {
    expect(legacyTensorPlanCode("starter")).toBe("free");
    expect(legacyTensorPlanCode("free")).toBe("free");
    expect(legacyTensorPlanCode("builder")).toBe("builder");
    expect(legacyTensorPlanCode("pro")).toBe("pro");
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
