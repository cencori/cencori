import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import type { AuthBrand } from "@/lib/auth/brand";

/**
 * The brand of the auth email being sent. Better Auth calls our email senders with only the
 * address and the code or link, so the route that asks it to send one says whose it is around
 * the call (withAuthBrand), and the sender reads it (currentAuthBrand).
 */
const store = new AsyncLocalStorage<AuthBrand>();

export function withAuthBrand<T>(brand: AuthBrand, run: () => Promise<T>): Promise<T> {
  return store.run(brand, run);
}

export function currentAuthBrand(): AuthBrand {
  return store.getStore() ?? "cencori";
}
