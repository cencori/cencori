import { describe, expect, it, vi } from "vitest";
import {
  basecodeCheckoutReference,
  effectiveBasecodePlan,
  getBasecodePlanByPaystackPlanCode,
  getPaystackPlanCode,
  paystackChannels,
  majorAmountToMinor,
  parseBasecodeCheckoutInput,
  resolveBasecodeCheckoutOrigin,
} from "@/lib/basecode-billing";

describe("Basecode billing contracts", () => {
  it("accepts only paid Basecode plan checkouts", () => {
    expect(
      parseBasecodeCheckoutInput({
        plan: "builder",
        provider: "paystack",
        paymentMethod: "opay",
      }),
    ).toEqual({ plan: "builder", provider: "paystack", paymentMethod: "opay", recurring: false });
    expect(parseBasecodeCheckoutInput({ plan: "free", provider: "paystack" })).toBeNull();
    expect(
      parseBasecodeCheckoutInput({ plan: "pro", provider: "bachs", paymentMethod: "opay" }),
    ).toBeNull();
  });

  it("only allows auto-renew on Paystack", () => {
    expect(
      parseBasecodeCheckoutInput({ plan: "pro", provider: "paystack", recurring: true }),
    ).toEqual({ plan: "pro", provider: "paystack", paymentMethod: "auto", recurring: true });
    expect(
      parseBasecodeCheckoutInput({ plan: "pro", provider: "bachs", recurring: true }),
    ).toBeNull();
    expect(
      parseBasecodeCheckoutInput({ plan: "pro", provider: "paystack", recurring: "yes" }),
    ).toEqual({ plan: "pro", provider: "paystack", paymentMethod: "auto", recurring: false });
  });

  it("maps Paystack plan codes to Basecode plans", () => {
    vi.stubEnv("PAYSTACK_PLAN_BASECODE_BUILDER", "PLN_builder_test");
    vi.stubEnv("PAYSTACK_PLAN_BASECODE_PRO", "PLN_pro_test");
    try {
      expect(getPaystackPlanCode("builder")).toBe("PLN_builder_test");
      expect(getPaystackPlanCode("pro")).toBe("PLN_pro_test");
      expect(getBasecodePlanByPaystackPlanCode("PLN_builder_test")).toBe("builder");
      expect(getBasecodePlanByPaystackPlanCode("PLN_pro_test")).toBe("pro");
      expect(getBasecodePlanByPaystackPlanCode("PLN_unknown")).toBeNull();
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
      effectiveBasecodePlan(
        { plan_code: "pro", status: "active", entitlement_ends_at: future },
        now,
      ),
    ).toBe("pro");
    expect(
      effectiveBasecodePlan(
        { plan_code: "pro", status: "active", entitlement_ends_at: past },
        now,
      ),
    ).toBe("free");
    expect(
      effectiveBasecodePlan(
        { plan_code: "builder", status: "past_due", entitlement_ends_at: future },
        now,
      ),
    ).toBe("free");
  });

  it("creates provider-safe checkout references", () => {
    expect(basecodeCheckoutReference("d8b6c53e-1fcb-44e1-b6f7-23aa19c6a3c1")).toBe(
      "basecode-d8b6c53e1fcb44e1b6f723aa19c6a3c1",
    );
  });

  it("always returns production checkouts to cencori.com", () => {
    expect(resolveBasecodeCheckoutOrigin("https://cencori.vercel.app", "production")).toBe(
      "https://cencori.com",
    );
    expect(
      resolveBasecodeCheckoutOrigin("https://cencori-feature.vercel.app", "preview"),
    ).toBe("https://cencori-feature.vercel.app");
  });
});
