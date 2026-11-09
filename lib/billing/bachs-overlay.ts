"use client";

/**
 * Opens a Bachs checkout in the Bachs overlay (bachs.js): a modal over our
 * page with the Bachs-hosted checkout in an iframe, so card data never
 * touches our page. If the script can't load (offline, blocked), the
 * browser goes to the hosted checkout page instead, which returns to the
 * same success URL.
 *
 * https://docs.bachs.io/guides/checkout/overlay-checkout
 */

const BACHS_JS_URL = "https://checkout.bachs.io/bachs.js";

type BachsOverlayEvent = {
  type:
    | "checkout.opened"
    | "checkout.loaded"
    | "checkout.ready"
    | "checkout.completed"
    | "checkout.failed"
    | "checkout.expired"
    | "checkout.closed"
    | "checkout.error";
  data?: { reason?: string; message?: string; reference?: string };
};

type BachsGlobal = {
  Checkout: {
    open(args: {
      checkoutUrl: string;
      onEvent?: (event: BachsOverlayEvent) => void;
      options?: { showCloseButton?: boolean; autoCloseOnComplete?: boolean };
    }): Promise<unknown>;
    close(): void;
    isOpen(): boolean;
  };
};

declare global {
  interface Window {
    Bachs?: BachsGlobal;
  }
}

let loading: Promise<BachsGlobal> | null = null;

function loadBachs(): Promise<BachsGlobal> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.Bachs) return Promise.resolve(window.Bachs);
  if (loading) return loading;

  loading = new Promise<BachsGlobal>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = BACHS_JS_URL;
    script.async = true;
    const timer = window.setTimeout(() => reject(new Error("bachs.js timed out")), 10_000);
    script.onload = () => {
      window.clearTimeout(timer);
      if (window.Bachs) resolve(window.Bachs);
      else reject(new Error("bachs.js loaded without Bachs"));
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("bachs.js failed to load"));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}

/** Start loading bachs.js ahead of time (e.g. when the upgrade dialog opens). */
export function preloadBachsCheckout() {
  void loadBachs().catch(() => {
    // Opening falls back to the hosted page.
  });
}

export type BachsCheckoutOutcome = "completed" | "closed" | "redirected";

/**
 * Open the checkout. Resolves "completed" when the payment went through,
 * "closed" when the customer closed it without paying (or it failed or
 * expired; the overlay shows why), and "redirected" when it fell back to the
 * hosted page.
 */
export async function openBachsCheckout(checkoutUrl: string): Promise<BachsCheckoutOutcome> {
  let bachs: BachsGlobal;
  try {
    bachs = await loadBachs();
  } catch {
    window.location.assign(checkoutUrl);
    return "redirected";
  }

  return new Promise<BachsCheckoutOutcome>((resolve) => {
    let completed = false;
    let settled = false;
    const settle = (outcome: BachsCheckoutOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    bachs.Checkout.open({
      checkoutUrl,
      options: { showCloseButton: true, autoCloseOnComplete: true },
      onEvent: (event) => {
        if (event.type === "checkout.completed") {
          completed = true;
          settle("completed");
        } else if (event.type === "checkout.closed") {
          settle(completed ? "completed" : "closed");
        }
      },
    }).catch(() => {
      // A bad URL for the overlay: use the hosted page.
      if (settled) return;
      settled = true;
      window.location.assign(checkoutUrl);
      resolve("redirected");
    });
  });
}

function getSafeReturnPath(orgSlug: string, returnPath?: string): string {
  return returnPath?.startsWith("/") && !returnPath.startsWith("//")
    ? returnPath
    : `/${encodeURIComponent(orgSlug)}/~/billing`;
}

/** Key the billing page reads to know what a returning checkout bought. */
export function checkoutStorageKey(checkoutId: string): string {
  return `cencori:checkout:${checkoutId}`;
}

/**
 * What a checkout is expected to change: the tier it buys, and for a renewal
 * the period end before paying (confirmed once that has moved).
 */
export type PendingCheckout = { tier: string; previousPeriodEnd: string | null };

export function readPendingCheckout(checkoutId: string): PendingCheckout | null {
  try {
    const raw = sessionStorage.getItem(checkoutStorageKey(checkoutId));
    if (!raw) return null;
    const [tier, previousPeriodEnd] = raw.split("|");
    return { tier, previousPeriodEnd: previousPeriodEnd || null };
  } catch {
    return null;
  }
}

export function forgetPendingCheckout(checkoutId: string) {
  try {
    sessionStorage.removeItem(checkoutStorageKey(checkoutId));
  } catch {
    // Storage unavailable.
  }
}

/**
 * Create a Bachs checkout on our server, open it in the overlay, and when it
 * completes go to the return page (default: the org's billing page) with
 * checkout_id, where the page waits for the webhook to apply it. Resolves
 * false when the customer closed the checkout without paying.
 */
export async function startBachsCheckout(params: {
  endpoint: string;
  body: Record<string, unknown>;
  tier: string;
  orgSlug: string;
  returnPath?: string;
  previousPeriodEnd?: string | null;
}): Promise<boolean> {
  const response = await fetch(params.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params.body),
  });
  const data = (await response.json().catch(() => ({}))) as {
    url?: string;
    checkoutId?: string;
    error?: string;
  };
  if (!response.ok || !data.url) {
    throw new Error(data.error || "Checkout couldn't be opened. Try again.");
  }

  if (data.checkoutId) {
    try {
      sessionStorage.setItem(
        checkoutStorageKey(data.checkoutId),
        `${params.tier}|${params.previousPeriodEnd ?? ""}`,
      );
    } catch {
      // Storage can be unavailable; the billing page still refreshes.
    }
  }

  const outcome = await openBachsCheckout(data.url);
  if (outcome === "redirected") return true;
  if (outcome === "closed") return false;

  const returnUrl = new URL(getSafeReturnPath(params.orgSlug, params.returnPath), window.location.origin);
  if (data.checkoutId) returnUrl.searchParams.set("checkout_id", data.checkoutId);
  window.location.assign(returnUrl.toString());
  return true;
}
