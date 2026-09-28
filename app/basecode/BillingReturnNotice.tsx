"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type BillingSnapshot = {
  plan: { code: string; name: string };
};

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20;

/**
 * Handles the return trip from a provider checkout.
 *
 * The webhook provisions the plan asynchronously, so the billing snapshot may still
 * read "free" when the user lands back. This polls until the paid plan appears
 * (or a timeout), so the return never looks like nothing happened.
 */
export function BillingReturnNotice() {
  const searchParams = useSearchParams();
  const returned = searchParams.get("billing_return");
  const cancelled = searchParams.get("billing_cancelled");
  const [state, setState] = useState<"confirming" | "active" | "slow" | null>(
    returned ? "confirming" : null,
  );

  useEffect(() => {
    if (!returned) return;
    let polls = 0;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      polls += 1;
      try {
        const response = await fetch("/api/basecode/billing", { cache: "no-store" });
        if (response.ok) {
          const snapshot = (await response.json()) as BillingSnapshot;
          if (snapshot.plan.code === "builder" || snapshot.plan.code === "pro") {
            if (!stopped) {
              setState("active");
              // Reload on the clean URL so the plans below refetch and show "Current plan".
              timer = setTimeout(() => window.location.replace("/basecode#plans"), 2500);
            }
            return;
          }
        }
      } catch {
        // A failed poll is just a missed round — the next one retries.
      }
      if (!stopped) {
        if (polls >= MAX_POLLS) {
          setState("slow");
        } else {
          timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
        }
      }
    };

    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [returned]);

  if (cancelled && !returned) {
    return (
      <p className="mx-auto max-w-6xl px-5 text-center text-xs text-white/60 md:px-8" role="status">
        Checkout was cancelled — no charge was made. You can pick a plan whenever you
        are ready.{" "}
        <a className="underline underline-offset-4 hover:text-white" href="/basecode#plans">
          Back to plans
        </a>
      </p>
    );
  }

  if (!returned || state === null) return null;

  if (state === "active") {
    return (
      <p className="mx-auto max-w-6xl px-5 text-center text-xs text-white md:px-8" role="status">
        Payment confirmed — your plan is now active. Refreshing…
      </p>
    );
  }

  if (state === "slow") {
    return (
      <p className="mx-auto max-w-6xl px-5 text-center text-xs text-white/60 md:px-8" role="status">
        Payment is still confirming — your plan will update automatically once the
        provider settles it. If you were charged and nothing changes, write to
        hello@cencori.com.{" "}
        <a className="underline underline-offset-4 hover:text-white" href="/basecode#plans">
          Back to plans
        </a>
      </p>
    );
  }

  return (
    <p className="mx-auto max-w-6xl px-5 text-center text-xs text-white/60 md:px-8" role="status">
      Confirming your payment…
    </p>
  );
}
