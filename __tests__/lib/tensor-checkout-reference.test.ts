import { describe, expect, it } from "vitest";
import { checkoutReference } from "@/lib/tensor-subscription-events";

/** An admin client that answers one table lookup from rows given here. */
function adminWith(rows: Array<Record<string, string>>) {
  return {
    from: () => {
      const filters: Array<[string, string]> = [];
      const query = {
        select: () => query,
        eq: (column: string, value: string) => {
          filters.push([column, value]);
          return query;
        },
        maybeSingle: async () => ({ data: rows.find((row) => filters.every(([column, value]) => row[column] === value)) ?? null }),
      };
      return query;
    },
  } as never;
}

const rows = [{ id: "ours-1", provider: "bachs", provider_checkout_id: "bachs-co-1", reference: "tensor_ref_1" }];
const empty = { reference: null, checkout_id: null, metadata: {} };

describe("finding the checkout a paid charge is for", () => {
  it("uses the charge's own reference when it has one", async () => {
    expect(await checkoutReference(adminWith(rows), { reference: "on_charge" }, empty)).toBe("on_charge");
  });

  it("falls back to our checkout id in the metadata", async () => {
    expect(await checkoutReference(adminWith(rows), { reference: "", metadata: { checkout_id: "ours-1" } }, empty)).toBe("tensor_ref_1");
  });

  it("falls back to Bachs's checkout id", async () => {
    expect(await checkoutReference(adminWith(rows), { reference: null }, { ...empty, checkout_id: "bachs-co-1" })).toBe("tensor_ref_1");
  });

  it("finds nothing for a charge no checkout of ours knows", async () => {
    expect(await checkoutReference(adminWith(rows), { reference: null, metadata: { checkout_id: "other" } }, empty)).toBeNull();
  });
});
