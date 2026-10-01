import { describe, expect, it, vi } from "vitest";
import {
  tensorCheckoutReference,
  effectiveTensorPlan,
  getTensorPlanByPaystackPlanCode,
  getPaystackPlanCode,
  paystackChannels,
  majorAmountToMinor,
  parseTensorCheckoutInput,
  resolveTensorCheckoutOrigin,
} from "@/lib/tensor-billing";

describe("Tensor billing contracts", () => {
  it("accepts only paid Tensor plan checkouts", () => {
    expect(
      parseTensorCheckoutInput({
        plan: "builder",
        provider: "paystack",
        paymentMethod: "opay",
      }),
    ).toEqual({ plan: "builder", provider: "paystack", paymentMethod: "opay", recurring: false });
    expect(parseTensorCheckoutInput({ plan: "free", provider: "paystack" })).toBeNull();
    expect(
      parseTensorCheckoutInput({ plan: "pro", provider: "bachs", paymentMethod: "opay" }),
    ).toBeNull();
  });

  it("only allows auto-renew on Paystack", () => {
    expect(
      parseTensorCheckoutInput({ plan: "pro", provider: "paystack", recurring: true }),
    ).toEqual({ plan: "pro", provider: "paystack", paymentMethod: "auto", recurring: true });
    expect(
      parseTensorCheckoutInput({ plan: "pro", provider: "bachs", recurring: true }),
    ).toBeNull();
    expect(
      parseTensorCheckoutInput({ plan: "pro", provider: "paystack", recurring: "yes" }),
    ).toEqual({ plan: "pro", provider: "paystack", paymentMethod: "auto", recurring: false });
  });

  it("maps Paystack plan codes to Tensor plans", () => {
    vi.stubEnv("PAYSTACK_PLAN_BASECODE_BUILDER", "PLN_builder_test");
    vi.stubEnv("PAYSTACK_PLAN_BASECODE_PRO", "PLN_pro_test");
    try {
      expect(getPaystackPlanCode("builder")).toBe("PLN_builder_test");
      expect(getPaystackPlanCode("pro")).toBe("PLN_pro_test");
      expect(getTensorPlanByPaystackPlanCode("PLN_builder_test")).toBe("builder");
      expect(getTensorPlanByPaystackPlanCode("PLN_pro_test")).toBe("pro");
      expect(getTensorPlanByPaystackPlanCode("PLN_unknown")).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("throws when a Paystack plan is unconfigured", () => {
    vi.stubEnv("PAYSTACK_PLAN_BASECODE_BUILDER", "");
    try {
      expect(() => getPaystackPlanCode("builder")).toThrow("No Paystack plan");
    } finally {
      vi.unstubAllEnvs();
    }
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

  it("falls back to free when a paid entitlement is inactive or expired", () => {
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
