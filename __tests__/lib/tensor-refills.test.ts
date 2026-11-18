import { describe, expect, it } from "vitest";
import { canRefill, refillPriceMinor } from "@/lib/tensor-refills";

const plan = (code: string, ngn: number | null, usd: number | null) => ({ code, price_ngn_minor: ngn, price_usd_minor: usd });

describe("what a refill costs", () => {
  it("is a week of the plan at half as much again, rounded up to 50 naira", () => {
    expect(refillPriceMinor(plan("starter", 200_000, null), "NGN")).toBe(70_000);
    expect(refillPriceMinor(plan("builder", 500_000, null), "NGN")).toBe(175_000);
    expect(refillPriceMinor(plan("pro", 1_500_000, null), "NGN")).toBe(525_000);
    expect(refillPriceMinor(plan("max", 3_000_000, null), "NGN")).toBe(1_050_000);
  });

  it("rounds dollars up to 50 cents, and has no price where the plan has none", () => {
    expect(refillPriceMinor(plan("starter", null, 200), "USD")).toBe(100);
    expect(refillPriceMinor(plan("starter", 200_000, null), "USD")).toBeNull();
    expect(refillPriceMinor(plan("free", 0, 0), "NGN")).toBeNull();
  });

  it("is always more than the plan's own weekly share", () => {
    for (const month of [200_000, 500_000, 1_500_000, 3_000_000]) {
      expect(refillPriceMinor(plan("p", month, null), "NGN")!).toBeGreaterThan((month * 7) / 30);
    }
  });
});

describe("when a refill is offered", () => {
  it("once a paid plan's week is used up, never on the trial", () => {
    expect(canRefill("starter", { budgetMicrousd: 230_000, costUsedMicrousd: 230_000 })).toBe(true);
    expect(canRefill("starter", { budgetMicrousd: 230_000, costUsedMicrousd: 100_000 })).toBe(false);
    expect(canRefill("free", { budgetMicrousd: 250_000, costUsedMicrousd: 300_000 })).toBe(false);
    expect(canRefill("enterprise", { budgetMicrousd: null, costUsedMicrousd: 1 })).toBe(false);
  });
});
