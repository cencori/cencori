"use client";

import { useEffect, useState } from "react";

type PackCode = "starter" | "builder" | "pro";

type BillingSnapshot = {
  plan: { name: string; tier?: "trial" | PackCode | "enterprise"; renewsAt: string | null };
  usage: { tasksUsed?: number; tasksLimit?: number | null };
};

const packs: Array<{
  code: PackCode;
  eyebrow: string;
  price: string;
  usd: string;
  description: string;
  features: string[];
}> = [
  {
    code: "starter",
    eyebrow: "Start",
    price: "₦2,000",
    usd: "$2",
    description: "35 tasks over 30 days, on Tensor's Auto model.",
    features: ["35 tasks", "Auto picks the model for you", "Pay once — nothing renews by itself"],
  },
  {
    code: "builder",
    eyebrow: "Build",
    price: "₦5,000",
    usd: "$5",
    description: "100 tasks over 30 days, with the open-weight models to choose from.",
    features: ["100 tasks", "Choose your own open-weight model", "Longer tasks than Starter"],
  },
  {
    code: "pro",
    eyebrow: "Ship",
    price: "₦15,000",
    usd: "$15",
    description: "60 tasks over 30 days on frontier models, each with far more room.",
    features: ["60 tasks", "GPT, Opus-class and Maximo models", "The longest tasks Tensor runs"],
  },
];

// Launch gate: Pro stays hidden until a frontier key is funded and its
// pricing row is active. Add "pro" back the moment that lands — one-line flip.
const ENABLED_PACKS: PackCode[] = ["starter", "builder"];

/** Where the signed-in account stands, said in one line. */
function describeStanding(snapshot: BillingSnapshot): string | null {
  const { tasksLimit, tasksUsed } = snapshot.usage;
  if (typeof tasksUsed !== "number" || typeof tasksLimit !== "number") return null;
  const left = Math.max(0, tasksLimit - tasksUsed);
  const tasks = `${left} of ${tasksLimit} tasks left`;
  if (snapshot.plan.tier === "trial") return `Trial · ${tasks}`;
  const ends = snapshot.plan.renewsAt ? new Date(snapshot.plan.renewsAt) : null;
  const until =
    ends && !Number.isNaN(ends.getTime())
      ? ` · until ${new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(ends)}`
      : "";
  return `${snapshot.plan.name} · ${tasks}${until}`;
}

export function TensorPlans() {
  const [standing, setStanding] = useState<string | null>(null);
  const [loading, setLoading] = useState<PackCode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/tensor/billing", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as BillingSnapshot;
      })
      .then((snapshot) => {
        if (active && snapshot) setStanding(describeStanding(snapshot));
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
        body: JSON.stringify({ plan }),
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

      <div className={`grid overflow-hidden rounded-xl border border-white/15 bg-black/25 backdrop-blur-md sm:grid-cols-2 ${packs.filter((p) => ENABLED_PACKS.includes(p.code)).length > 2 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        {packs.filter((pack) => ENABLED_PACKS.includes(pack.code)).map((pack) => {
          return (
            <article
              className={`flex min-h-[28rem] flex-col border-white/10 p-5 sm:[&:nth-child(odd)]:border-r lg:border-r lg:last:border-r-0 ${
                pack.code === "pro" ? "bg-white/[0.07]" : "bg-white/[0.025]"
              }`}
              key={pack.code}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
                  {pack.eyebrow}
                </p>
                {pack.code === "pro" ? (
                  <span className="rounded-full border border-white/20 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-white/70">
                    Frontier
                  </span>
                ) : null}
              </div>
              <h3 className="mt-8 text-xl font-medium tracking-[-0.035em] text-white">
                {pack.code[0].toUpperCase() + pack.code.slice(1)}
              </h3>
              <div className="mt-3 flex items-baseline gap-2">
                <strong className="text-3xl font-semibold tracking-[-0.055em] text-white">
                  {pack.price}
                </strong>
                <span className="text-[11px] text-white/40">or {pack.usd} · for 30 days</span>
              </div>
              <p className="mt-5 min-h-12 text-sm leading-5 text-white/55">{pack.description}</p>
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
                  {loading === pack.code
                    ? "Opening…"
                    : `Buy ${pack.code[0].toUpperCase() + pack.code.slice(1)}`}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {error ? (
        <p className="mt-4 text-center text-xs text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      <p className="mt-5 text-center text-[11px] leading-5 text-white/40">
        Payments are processed by Bachs, in naira or dollars. Every payment is one-off and buys 30
        days — nothing renews by itself. A task is one request to Tensor, however many steps it
        takes to finish.
      </p>
    </section>
  );
}
