import { describe, expect, it } from "vitest";
import { refillAmountAllowed, refillCreditMicrousd, refillOffer, refillWeekMinor } from "@/lib/tensor-refills";

const starter = { code: "starter", price_ngn_minor: 200_000, price_usd_minor: 150, pass_budget_microusd: 1_000_000, billing_period_days: 30 };
const max = { code: "max", price_ngn_minor: 3_000_000, price_usd_minor: null, pass_budget_microusd: 11_000_000, billing_period_days: 30 };
const trial = { code: "free", price_ngn_minor: 0, price_usd_minor: 0, pass_budget_microusd: 250_000, billing_period_days: 30 };

describe("what a refill buys", () => {
  it("at the plan's own rate made half as dear again", () => {
    // Starter sells $1.00 of usage for 2,000 naira; a refill sells it for 3,000.
    expect(refillCreditMicrousd(starter, 300_000, "NGN")).toBe(1_000_000);
    expect(refillCreditMicrousd(starter, 70_000, "NGN")).toBe(233_333);
  });

  it("always less usage per naira than the plan itself", () => {
    for (const plan of [starter, max]) {
      const viaPlan = plan.pass_budget_microusd / plan.price_ngn_minor;
      expect(refillCreditMicrousd(plan, 1_000_000, "NGN")! / 1_000_000).toBeLessThan(viaPlan);
    }
  });

  it("nothing on the trial, or in a currency the plan has no price in", () => {
    expect(refillCreditMicrousd(trial, 100_000, "NGN")).toBeNull();
    expect(refillCreditMicrousd(max, 1_000, "USD")).toBeNull();
  });
});

describe("the amounts offered", () => {
  it("a week of usage, rounded up, as the unit", () => {
    expect(refillWeekMinor(starter, "NGN")).toBe(70_000);
    expect(refillWeekMinor(max, "NGN")).toBe(1_050_000);
    expect(refillOffer(trial)).toBeNull();
  });

  it("whole naira within the limits", () => {
    expect(refillAmountAllowed(70_000, "NGN")).toBe(true);
    expect(refillAmountAllowed(70_050, "NGN")).toBe(false);
    expect(refillAmountAllowed(40_000, "NGN")).toBe(false);
    expect(refillAmountAllowed(20_000_000, "NGN")).toBe(false);
    expect(refillAmountAllowed("700", "NGN")).toBe(false);
  });
});
