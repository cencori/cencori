import { describe, expect, it } from "vitest";
import {
  readProxiedTensorTurn,
  TENSOR_MODEL_POLICY_HEADER,
  TENSOR_USER_HEADER,
} from "@/lib/tensor-entitlement";

const PRODUCT_KEY = "csk_product_key_for_tensor";
const USER = "01965881-fb23-4bd1-a778-d48530b7c853";

function headers(values: Record<string, string>) {
  return new Headers(values);
}

describe("a Tensor call that arrives through the proxy", () => {
  it("is attributed to the user the proxy named", () => {
    expect(
      readProxiedTensorTurn(
        headers({ [TENSOR_USER_HEADER]: USER, [TENSOR_MODEL_POLICY_HEADER]: "open_weight" }),
        PRODUCT_KEY,
        PRODUCT_KEY,
      ),
    ).toEqual({ userId: USER, modelPolicy: "open_weight" });
  });

  /** The reason the headers are safe to believe: only the server holds the product key. */
  it("is not believed on any other key", () => {
    expect(
      readProxiedTensorTurn(
        headers({ [TENSOR_USER_HEADER]: USER, [TENSOR_MODEL_POLICY_HEADER]: "frontier" }),
        "csk_a_customers_own_key",
        PRODUCT_KEY,
      ),
    ).toBeNull();
  });

  it("is not believed when no product key is configured", () => {
    expect(
      readProxiedTensorTurn(
        headers({ [TENSOR_USER_HEADER]: USER, [TENSOR_MODEL_POLICY_HEADER]: "auto" }),
        "",
        "",
      ),
    ).toBeNull();
  });

  it("needs a real user and a known model policy", () => {
    expect(
      readProxiedTensorTurn(
        headers({ [TENSOR_USER_HEADER]: "everyone", [TENSOR_MODEL_POLICY_HEADER]: "auto" }),
        PRODUCT_KEY,
        PRODUCT_KEY,
      ),
    ).toBeNull();
    expect(
      readProxiedTensorTurn(
        headers({ [TENSOR_USER_HEADER]: USER, [TENSOR_MODEL_POLICY_HEADER]: "unlimited" }),
        PRODUCT_KEY,
        PRODUCT_KEY,
      ),
    ).toBeNull();
    expect(readProxiedTensorTurn(headers({}), PRODUCT_KEY, PRODUCT_KEY)).toBeNull();
  });
});
