"use client";

import { useEffect, useState } from "react";

type PlanCode = "free" | "builder" | "pro" | "enterprise";
type PackCode = "starter" | "builder" | "pro";
type CheckoutMethod = "opay" | "banktransfer" | "international";

type BillingSnapshot = {
  plan: { code: PlanCode; name: string };
  usage: { percentageUsed: number; resetsAt: string | null };
  prepaid?: { balanceMicrousd: number; totalCreditedMicrousd: number };
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
    eyebrow: "Top up",
    price: "₦2,000",
    usd: "$2",
    description: "Turns on the auto model. No picker change.",
    features: ["Pay once, burn as you go", "Hard stop at zero — never a bill", "Top up again whenever you run out"],
  },
  {
    code: "builder",
    eyebrow: "Build",
    price: "₦5,000",
    usd: "$5",
    description: "Unlocks the open-weight picker + extra turns.",
    features: ["Unlocks selectable open-weight models", "Plenty of room for daily building", "Pay once, burn as you go"],
  },
  {
    code: "pro",
    eyebrow: "Ship",
    price: "₦15,000",
    usd: "$15",
    description: "Unlocks frontier models + the most turns.",
    features: ["Unlocks GPT / Opus-class models", "Built for serious shipping weeks", "Pay once, burn as you go"],
  },
];

// Launch gate: Pro stays hidden until a frontier key is funded and its
// pricing row is active. Add "pro" back the moment that lands — one-line flip.
const ENABLED_PACKS: PackCode[] = ["starter", "builder"];

function checkoutPayload(pack: PackCode, method: CheckoutMethod) {
  if (method === "international") {
    return { paymentMethod: "auto", pack, provider: "bachs" };
  }
  return { paymentMethod: method, pack, provider: "paystack" };
}

function formatCredit(microusd: number): string {
  return `$${(microusd / 1_000_000).toFixed(2)}`;
}

export function TensorPlans() {
  const [currentPlan, setCurrentPlan] = useState<PlanCode | null>(null);
  const [balanceMicrousd, setBalanceMicrousd] = useState<number | null>(null);
  const [selectedPack, setSelectedPack] = useState<PackCode | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/tensor/billing", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as BillingSnapshot;
      })
      .then((snapshot) => {
        if (active && snapshot) {
          setCurrentPlan(snapshot.plan.code);
          if (snapshot.prepaid) setBalanceMicrousd(snapshot.prepaid.balanceMicrousd);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function beginCheckout(pack: PackCode, method: CheckoutMethod) {
    const key = `${pack}:${method}`;
    setLoading(key);
    setError(null);
    try {
      const response = await fetch("/api/tensor/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutPayload(pack, method)),
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
        {balanceMicrousd !== null ? (
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs text-white/75">
            Credit balance: <strong className="text-white">{formatCredit(balanceMicrousd)}</strong>
            {currentPlan && currentPlan !== "free" ? (
              <span className="text-white/45">· {currentPlan} picker unlocked</span>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className={`grid overflow-hidden rounded-xl border border-white/15 bg-black/25 backdrop-blur-md sm:grid-cols-2 ${packs.filter((p) => ENABLED_PACKS.includes(p.code)).length > 2 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        {packs.filter((pack) => ENABLED_PACKS.includes(pack.code)).map((pack) => {
          const isSelected = selectedPack === pack.code;
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
                <span className="text-[11px] text-white/40">one-off</span>
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
                {isSelected ? (
                  <div className="grid gap-2" aria-label={`Buy ${pack.code}`}>
                    <button
                      className="h-9 rounded-md bg-white text-xs font-medium text-black transition-colors hover:bg-white/85 disabled:opacity-50"
                      disabled={loading !== null}
                      onClick={() => void beginCheckout(pack.code, "opay")}
                      type="button"
                    >
                      {loading === `${pack.code}:opay` ? "Opening…" : "Pay with OPay"}
                    </button>
                    <button
                      className="h-9 rounded-md border border-white/20 text-xs font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-50"
                      disabled={loading !== null}
                      onClick={() => void beginCheckout(pack.code, "banktransfer")}
                      type="button"
                    >
                      {loading === `${pack.code}:banktransfer` ? "Opening…" : "Bank transfer"}
                    </button>
                    <button
                      className="h-8 text-[11px] text-white/45 transition-colors hover:text-white/75 disabled:opacity-50"
                      disabled={loading !== null}
                      onClick={() => void beginCheckout(pack.code, "international")}
                      type="button"
                    >
                      {loading === `${pack.code}:international` ? "Opening…" : `International card · ${pack.usd}`}
                    </button>
                  </div>
                ) : (
                  <button
                    className="h-9 w-full rounded-md bg-white text-xs font-medium text-black transition-colors hover:bg-white/85"
                    onClick={() => setSelectedPack(pack.code)}
                    type="button"
                  >
                    Buy {pack.code[0].toUpperCase() + pack.code.slice(1)}
                  </button>
                )}
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
        OPay and Nigerian bank transfers are processed by Paystack. International card checkout
        is processed by Bachs. Every payment is one-off — no auto-renew. Credit burns at real
        provider cost and stops at zero. Weekly velocity caps still pace heavy burn.
      </p>
    </section>
  );
}
