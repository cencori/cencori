/**
 * Whose sign-in a visitor is in. Tensor's accounts are Cencori accounts and Cencori runs the
 * sign-in, but someone signing in to Tensor sees Tensor: its mark, its name and its words, with
 * a small "Secured by Cencori". They are known by where the sign-in returns them to, Tensor's
 * own step (app/tensor/sign-in), which every auth page already carries as ?redirect=.
 */
export type AuthBrand = "cencori" | "tensor";

export function authBrandFor(redirect: string | null | undefined): AuthBrand {
  return typeof redirect === "string" && redirect.startsWith("/tensor/sign-in") ? "tensor" : "cencori";
}
