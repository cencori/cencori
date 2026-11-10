import { describe, expect, it } from "vitest";
import {
  tensorCheckoutReference,
  effectiveTensorPlan,
  legacyTensorPlanCode,
  tensorPlanPriceMinor,
  majorAmountToMinor,
  parseTensorCheckoutInput,
  oneMonthAfter,
  readAllowancePeriod,
  readTensorSubscription,
  resolveTensorCheckoutOrigin,
  tensorCheckoutReturnUrl,
  TENSOR_WEB_BILLING_URL,
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

  it("returns a checkout opened on the Tensor website to its billing page, and nowhere else", () => {
    expect(
      parseTensorCheckoutInput({ plan: "builder", return_url: TENSOR_WEB_BILLING_URL }),
    ).toEqual({ plan: "builder", returnUrl: TENSOR_WEB_BILLING_URL });
    expect(tensorCheckoutReturnUrl("https://www.tensorade.app/billing")).toBe("https://www.tensorade.app/billing");
    expect(tensorCheckoutReturnUrl("http://127.0.0.1:3001/billing")).toBe(
      "http://127.0.0.1:3001/billing",
    );

    for (const value of [
      "https://evil.com/billing",
      "https://tensorade.app.evil.com/billing",
      "https://www.tensorade.app.evil.com/billing",
      "http://www.tensorade.app/billing",
      "http://tensorade.app/billing",
      "https://tensorade.app/billing?next=https://evil.com",
      "https://tensorade.app/settings",
      "http://localhost:3001/billing",
      "http://127.0.0.1:80/billing",
      "javascript:alert(1)",
      42,
    ]) {
      expect(tensorCheckoutReturnUrl(value)).toBeNull();
    }
    // An unrecognised return page is dropped, not refused: the checkout still opens, and comes
    // back to cencori.com/tensor.
    expect(parseTensorCheckoutInput({ plan: "starter", return_url: "https://evil.com/billing" })).toEqual({
      plan: "starter",
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

  /**
   * Older desktop builds decide which models to offer from the code alone, so the code they get
   * says what the account may use: hidden model, open-weight, or everything.
   */
  it("reports a plan to released desktop builds by the models it may use", () => {
    expect(legacyTensorPlanCode("free", "auto")).toBe("free");
    expect(legacyTensorPlanCode("starter", "auto")).toBe("free");
    expect(legacyTensorPlanCode("builder", "auto")).toBe("free");
    expect(legacyTensorPlanCode("pro", "auto")).toBe("free");
    expect(legacyTensorPlanCode("max", "frontier")).toBe("pro");
    expect(legacyTensorPlanCode("ultra", "frontier")).toBe("pro");
    // Passes bought before the ladder keep their models until they end.
    expect(legacyTensorPlanCode("builder", "open_weight")).toBe("builder");
    expect(legacyTensorPlanCode("pro", "frontier")).toBe("pro");
    expect(legacyTensorPlanCode("enterprise", "custom")).toBe("enterprise");
  });

  it("sells Max and Ultra, in naira or dollars", () => {
    expect(parseTensorCheckoutInput({ plan: "max", currency: "ngn" })).toEqual({
      plan: "max",
      currency: "NGN",
    });
    expect(parseTensorCheckoutInput({ plan: "ultra", currency: "USD" })).toEqual({
      plan: "ultra",
      currency: "USD",
    });
    // A currency Tensor does not sell in is not a reason to refuse the checkout.
    expect(parseTensorCheckoutInput({ plan: "starter", currency: "EUR" })).toEqual({ plan: "starter" });
  });

  it("reads a subscription by whether it is still being collected on", () => {
    expect(
      readTensorSubscription({
        status: "trialing",
        current_period_end: "2026-12-10T00:00:00+00:00",
        cancel_at_period_end: false,
        currency: "USD",
      }),
    ).toEqual({
      status: "active",
      renewsAt: "2026-12-10T00:00:00+00:00",
      cancelAtPeriodEnd: false,
      currency: "USD",
    });
    expect(readTensorSubscription({ status: "unpaid" })?.status).toBe("past_due");
    expect(readTensorSubscription({ status: "paused" })?.status).toBe("canceled");
    expect(readTensorSubscription({ status: "something-new" })).toBeNull();
    expect(readTensorSubscription(null)).toBeNull();
  });

  it("takes a first charge to pay for one calendar month", () => {
    expect(oneMonthAfter(new Date("2026-11-10T08:00:00Z")).toISOString()).toBe(
      "2026-12-10T08:00:00.000Z",
    );
    // The 31st has no counterpart next month; the month's last day is what is meant.
    expect(oneMonthAfter(new Date("2027-01-31T08:00:00Z")).toISOString()).toBe(
      "2027-02-28T08:00:00.000Z",
    );
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

  /** The usage screen trusts this row for where the week starts, so a malformed one is refused. */
  it("reads the allowance period the database reports, and refuses one without a start", () => {
    expect(
      readAllowancePeriod({
        plan_code: "starter",
        starts_at: "2026-11-10T00:00:00+00:00",
        ends_at: "2026-11-17T00:00:00+00:00",
        task_limit: 9,
        pass_ends_at: "2026-12-10T00:00:00+00:00",
        // A bigint sum arrives as a string.
        pass_cost_used_microusd: "540000",
      }),
    ).toEqual({
      startsAt: "2026-11-10T00:00:00+00:00",
      endsAt: "2026-11-17T00:00:00+00:00",
      taskLimit: 9,
      passEndsAt: "2026-12-10T00:00:00+00:00",
      passCostUsedMicrousd: 540000,
      modelPolicy: null,
    });
    // Enterprise has no task limit and no end.
    expect(
      readAllowancePeriod({ starts_at: "2026-11-10T00:00:00+00:00", ends_at: null, task_limit: null }),
    ).toEqual({
      startsAt: "2026-11-10T00:00:00+00:00",
      endsAt: null,
      taskLimit: null,
      passEndsAt: null,
      passCostUsedMicrousd: 0,
      modelPolicy: null,
    });
    expect(readAllowancePeriod(null)).toBeNull();
    expect(readAllowancePeriod({ ends_at: "2026-11-17T00:00:00+00:00" })).toBeNull();
  });
});
