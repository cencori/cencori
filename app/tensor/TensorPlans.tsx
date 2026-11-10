"use client";

import { useEffect, useState } from "react";

type PackCode = "starter" | "builder" | "pro" | "max" | "ultra";
type Currency = "NGN" | "USD";

type BillingSnapshot = {
  plan: {
    name: string;
    tier?: "trial" | PackCode | "enterprise";
    renewsAt: string | null;
    endsAt?: string | null;
    renews?: boolean;
  };
  subscription?: { status: string; cancelAtPeriodEnd: boolean } | null;
  usage: { tasksUsed?: number; tasksLimit?: number | null; percentageUsed?: number };
};

/**
 * The ladder. On the first three Tensor picks the model and the allowance is tasks a week; on the
 * last two the customer picks any model and the allowance is usage, which a frontier model spends
 * faster than a small one. Prices are the naira price and the dollar price of the same plan.
 */
const packs: Array<{
  code: PackCode;
  group: "auto" | "choice";
  ngn: string;
  usd: string;
  description: string;
  features: string[];
}> = [
  {
    code: "starter",
    group: "auto",
    ngn: "₦2,000",
    usd: "$2",
    description: "For trying Tensor on real work.",
    features: ["9 tasks every week", "Tensor picks the model", "Every task runs until it's done"],
  },
  {
    code: "builder",
    group: "auto",
    ngn: "₦5,000",
    usd: "$5",
    description: "For building most days.",
    features: ["27 tasks every week", "3x Starter", "Tensor picks the model"],
  },
  {
    code: "pro",
    group: "auto",
    ngn: "₦15,000",
    usd: "$15",
    description: "For shipping every day.",
    features: ["81 tasks every week", "9x Starter", "Tensor picks the model"],
  },
  {
    code: "max",
    group: "choice",
    ngn: "₦30,000",
    usd: "$20",
    description: "Choose any model, frontier included.",
    features: ["Pick your own model", "A month of usage, shown as a meter", "Small models stretch it further"],
  },
  {
    code: "ultra",
    group: "choice",
    ngn: "₦150,000",
    usd: "$100",
    description: "For working in frontier models all day.",
    features: ["Pick your own model", "5x the usage of Max", "Two tasks at once"],
  },
];

const GROUPS: Array<{ id: "auto" | "choice"; title: string; note: string }> = [
  { id: "auto", title: "Tensor picks the model", note: "The affordable way in. You describe the work; Tensor chooses what runs it." },
  { id: "choice", title: "You pick the model", note: "Every model, frontier included, metered by what it costs to run." },
];

// The plans on sale. Max and Ultra run on frontier models, so the frontier key has to stay funded.
// Remove a code here to stop selling it.
const ENABLED_PACKS: PackCode[] = ["starter", "builder", "pro", "max", "ultra"];

/** Naira for a visitor in Nigeria, dollars for everyone else; either can switch. */
function defaultCurrency(): Currency {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone === "Africa/Lagos" ? "NGN" : "USD";
  } catch {
    return "USD";
  }
}

/** Where the signed-in account stands, said in one line. */
function describeStanding(snapshot: BillingSnapshot): string | null {
  const { tasksLimit, tasksUsed, percentageUsed } = snapshot.usage;
  const day = (value: string | null | undefined): string | null => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(date)
      : null;
  };
  if (snapshot.plan.tier === "trial") {
    if (typeof tasksUsed !== "number" || typeof tasksLimit !== "number") return null;
    return `Trial · ${Math.max(0, tasksLimit - tasksUsed)} of ${tasksLimit} tasks left`;
  }
  // Plans counted in tasks refill every week; plans counted in usage say how much is gone.
  const allowance =
    typeof tasksUsed === "number" && typeof tasksLimit === "number"
      ? `${Math.max(0, tasksLimit - tasksUsed)} of ${tasksLimit} tasks left this week`
      : typeof percentageUsed === "number"
        ? `${percentageUsed}% of this month's usage used`
        : null;
  const end = day(snapshot.plan.endsAt);
  const term = end ? (snapshot.plan.renews ? `renews ${end}` : `ends ${end}`) : null;
  return [snapshot.plan.name, allowance, term].filter(Boolean).join(" · ");
}

export function TensorPlans() {
  const [standing, setStanding] = useState<string | null>(null);
  const [loading, setLoading] = useState<PackCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [subscribed, setSubscribed] = useState(false);

  // Decided after mount so the server and the first client render agree.
  useEffect(() => setCurrency(defaultCurrency()), []);

  useEffect(() => {
    let active = true;
    void fetch("/api/tensor/billing", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as BillingSnapshot;
      })
      .then((snapshot) => {
        if (!active || !snapshot) return;
        setStanding(describeStanding(snapshot));
        setSubscribed(Boolean(snapshot.subscription && snapshot.subscription.status !== "canceled"));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function beginCheckout(plan: PackCode) {
    setLoading(plan);
    setError(null);
    try {
      const response = await fetch("/api/tensor/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, currency }),
      });
      if (response.status === 401) {
        window.location.assign(`/login?redirect=${encodeURIComponent("/tensor#plans")}`);
        return;
      }
      const result = (await response.json()) as { checkoutUrl?: string; error?: string };
      if (!response.ok || !result.checkoutUrl) {
        throw new Error(result.error || "Checkout could not be started.");
      }
      window.location.assign(result.checkoutUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout could not be started.");
      setLoading(null);
    }
  }

  /** Cancelling, changing the card and invoices all live in Bachs's portal. */
  async function manageSubscription() {
    setError(null);
    try {
      const response = await fetch("/api/tensor/billing/subscription/cancel", { method: "POST" });
      const result = (await response.json()) as { manageUrl?: string; error?: string };
      if (!response.ok || !result.manageUrl) {
        throw new Error(result.error || "Subscription management could not be opened.");
      }
      window.location.assign(result.manageUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Subscription management could not be opened.");
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-5 pb-24 pt-16 md:px-8 md:pb-32 md:pt-24" id="plans">
      <div className="mb-10">
        <h2 className="max-w-xl text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">
          Get started with Tensor
        </h2>
        {standing ? (
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs text-white/75">
            {standing}
          </p>
        ) : null}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div
          aria-label="Currency"
          className="inline-flex rounded-md border border-white/15 p-0.5 text-xs"
          role="group"
        >
          {(["NGN", "USD"] as const).map((option) => (
            <button
              aria-pressed={currency === option}
              className={`rounded px-3 py-1 transition-colors ${
                currency === option ? "bg-white text-black" : "text-white/60 hover:text-white"
              }`}
              key={option}
              onClick={() => setCurrency(option)}
              type="button"
            >
              {option === "NGN" ? "Naira" : "Dollars"}
            </button>
          ))}
        </div>
        {subscribed ? (
          <button
            className="text-xs text-white/60 underline underline-offset-4 hover:text-white"
            onClick={() => void manageSubscription()}
            type="button"
          >
            Manage subscription
          </button>
        ) : null}
      </div>

      {GROUPS.map((group) => {
        const shown = packs.filter(
          (pack) => pack.group === group.id && ENABLED_PACKS.includes(pack.code),
        );
        if (!shown.length) return null;
        return (
          <div className="mb-8" key={group.id}>
            <h3 className="text-sm font-medium text-white">{group.title}</h3>
            <p className="mt-1 text-xs text-white/50">{group.note}</p>
            <div
              className={`mt-4 grid overflow-hidden rounded-xl border border-white/15 bg-black/25 backdrop-blur-md sm:grid-cols-2 ${
                shown.length > 2 ? "lg:grid-cols-3" : "lg:grid-cols-2"
              }`}
            >
              {shown.map((pack) => {
                const name = pack.code[0].toUpperCase() + pack.code.slice(1);
                return (
                  <article
                    className="flex min-h-[24rem] flex-col border-white/10 bg-white/[0.025] p-5 sm:[&:nth-child(odd)]:border-r lg:border-r lg:last:border-r-0"
                    key={pack.code}
                  >
                    <h4 className="text-xl font-medium tracking-[-0.035em] text-white">{name}</h4>
                    <div className="mt-3 flex items-baseline gap-2">
                      <strong className="text-3xl font-semibold tracking-[-0.055em] text-white">
                        {currency === "NGN" ? pack.ngn : pack.usd}
                      </strong>
                      <span className="text-[11px] text-white/40">a month</span>
                    </div>
                    <p className="mt-5 min-h-10 text-sm leading-5 text-white/55">{pack.description}</p>
                    <ul className="mt-6 grid gap-3 border-t border-white/10 pt-5 text-xs text-white/70">
                      {pack.features.map((feature) => (
                        <li className="flex gap-2" key={feature}>
                          <span aria-hidden="true" className="text-white/35">—</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-8">
                      <button
                        className="h-9 w-full rounded-md bg-white text-xs font-medium text-black transition-colors hover:bg-white/85 disabled:opacity-50"
                        disabled={loading !== null}
                        onClick={() => void beginCheckout(pack.code)}
                        type="button"
                      >
                        {loading === pack.code ? "Opening…" : `Get ${name}`}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        );
      })}

      {error ? (
        <p className="mt-4 text-center text-xs text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      <p className="mt-5 text-center text-[11px] leading-5 text-white/40">
        Payments are processed by Bachs. In dollars a plan is a monthly subscription you can cancel
        at any time. In naira each payment covers one month, and paying again before it ends adds a
        month rather than restarting it. A task is one request to Tensor, however many steps it
        takes to finish.
      </p>
    </section>
  );
}
