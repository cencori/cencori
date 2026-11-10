"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CENCORI_PAID_PLANS,
  getAvailableUpgradePlans,
  getMonthlyEquivalentCents,
  isUpgradeReason,
  UPGRADE_REASONS,
  type PaidPlanTier,
  type PlanBillingInterval,
} from "@/lib/billing/plans";
import { preloadBachsCheckout, startBachsCheckout } from "@/lib/billing/bachs-overlay";
import { formatCurrency } from "@/lib/currency";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { cn } from "@/lib/utils";

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgSlug: string;
  orgName?: string;
  currentTier?: "free" | PaidPlanTier;
  /**
   * What the user reached for: a known reason ("history", "projects", ...)
   * puts that feature first in the list. Other text is ignored.
   */
  reason?: string;
  recommendedTier?: PaidPlanTier;
  checkoutMode?: "review" | "direct";
  /** Load the Bachs checkout script ahead of opening. */
  preload?: boolean;
  returnPath?: string;
}

function formatCents(cents: number, maximumFractionDigits = 2): string {
  return formatCurrency(cents / 100, "USD", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

/**
 * Plan prices in the dashboard's display currency (the USD/NGN toggle). In
 * naira a plan shows its set naira price (Pro: ₦20,000/mo), and amounts
 * derived from the dollar price (annual per month) scale with it. Card
 * subscriptions are still charged in dollars; naira checkout charges naira.
 */
function usePlanPrice(tier: PaidPlanTier) {
  const { currency, formatMoney } = useDisplayCurrency();
  const plan = CENCORI_PAID_PLANS[tier];
  const format = (cents: number) => {
    if (currency !== "NGN") return formatCents(cents);
    if (!plan.ngnPrices) return formatMoney(cents / 100);
    const nairaPerCent = plan.ngnPrices.month / plan.prices.month;
    return formatCurrency(Math.round(cents * nairaPerCent), "NGN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };
  return { currency, format };
}

function getInitialTier(
  currentTier: "free" | PaidPlanTier,
  recommendedTier: PaidPlanTier,
): PaidPlanTier {
  const availablePlans = getAvailableUpgradePlans(currentTier);
  return availablePlans.includes(recommendedTier)
    ? recommendedTier
    : (availablePlans[0] ?? "pro");
}

/** The payment part of the checkout card: the totals, and the footer with the authorization note and the button. */
function PaymentPanel({
  action,
  error,
  inNaira,
  totals,
}: {
  action: ReactNode;
  error: string | null;
  /** Paying the naira price (a prepaid period), not the dollar subscription. */
  inNaira: boolean;
  totals: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-8 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        {totals}

        {error && <CheckoutError message={error} />}
      </div>

      <PanelFooter action={action}>
        {inNaira ? "By subscribing, you agree to the" : "By subscribing, you authorize Cencori to charge you according to the"}{" "}
        <Link
          href="/terms-of-service"
          className="underline underline-offset-2 hover:text-foreground"
        >
          terms
        </Link>
        {inNaira ? "" : " until you cancel"}. See our{" "}
        <Link
          href="/privacy-policy"
          className="underline underline-offset-2 hover:text-foreground"
        >
          privacy policy
        </Link>
        .
      </PanelFooter>
    </div>
  );
}

export function UpgradeDialog({
  open,
  onOpenChange,
  orgId,
  orgSlug,
  orgName,
  currentTier = "free",
  recommendedTier = "pro",
  checkoutMode = "review",
  preload = false,
  returnPath,
  reason,
}: UpgradeDialogProps) {
  const { currency: displayCurrency } = useDisplayCurrency();
  const availablePlans = useMemo(
    () => getAvailableUpgradePlans(currentTier),
    [currentTier],
  );
  const directTier = getInitialTier(currentTier, recommendedTier);
  const [selectedTier, setSelectedTier] = useState<PaidPlanTier>(directTier);
  const [interval, setInterval] = useState<PlanBillingInterval>("month");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkoutTier = checkoutMode === "direct" ? directTier : selectedTier;
  const checkoutInterval = checkoutMode === "direct" ? "month" : interval;
  const plan = CENCORI_PAID_PLANS[checkoutTier];
  const dueNow = plan.prices[checkoutInterval];
  const organizationLabel = orgName || orgSlug || "your organization";

  useEffect(() => {
    if (!open) return;
    setSelectedTier(directTier);
    if (checkoutMode === "direct") setInterval("month");
    setError(null);
  }, [checkoutMode, directTier, open]);

  useEffect(() => {
    if (open || preload) preloadBachsCheckout();
  }, [open, preload]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && paying) return;
    if (!nextOpen) setError(null);
    onOpenChange(nextOpen);
  };

  // The currency the price is shown in is the currency the customer pays:
  // naira opens the naira checkout (a prepaid month or year, since Bachs
  // can't bill naira subscriptions yet), dollars the card subscription.
  const inNaira = displayCurrency === "NGN" && Boolean(plan.ngnPrices?.[checkoutInterval]);

  const subscribe = useCallback(async () => {
    if (paying) return;
    if (!orgId) {
      setError("We couldn't identify this organization. Refresh and try again.");
      return;
    }
    setPaying(true);
    setError(null);
    try {
      const done = await startBachsCheckout(
        inNaira
          ? {
              endpoint: "/api/billing/checkout/naira",
              body: { orgId, interval: checkoutInterval },
              tier: checkoutTier,
              orgSlug,
              returnPath,
            }
          : {
              endpoint: "/api/billing/checkout",
              body: { orgId, tier: checkoutTier, interval: checkoutInterval },
              tier: checkoutTier,
              orgSlug,
              returnPath,
            },
      );
      if (!done) setPaying(false);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Checkout couldn't be opened. Try again.",
      );
      setPaying(false);
    }
  }, [checkoutInterval, checkoutTier, inNaira, orgId, orgSlug, paying, returnPath]);

  const totals = (
    <OrderTotals dueNow={dueNow} inNaira={inNaira} interval={checkoutInterval} tier={checkoutTier} />
  );

  // Desktop: a centered dialog. Mobile (below sm): a bottom sheet pinned to
  // the bottom edge. Either way the scrolling body and pinned footer stack in
  // a flex column capped in height.
  //
  // Non-modal on purpose: a modal dialog makes everything outside it inert,
  // including the Bachs checkout that opens on top. So the dimmed backdrop
  // is drawn here (Radix only draws one for modal dialogs); clicking it is an
  // outside click, which closes the dialog unless a checkout is open.
  return (
    <>
    {open && typeof document !== "undefined" && createPortal(
      <div aria-hidden="true" className="fixed inset-0 z-[49] bg-black/70 backdrop-blur-[1px]" />,
      document.body,
    )}
    <Dialog open={open} onOpenChange={handleOpenChange} modal={false}>
      <DialogContent
        animated={false}
        showOverlay={false}
        showCloseButton={false}
        // Opening focuses the close button by default, drawing a focus ring
        // around it; leave focus where it was instead.
        onOpenAutoFocus={(event) => event.preventDefault()}
        // The Bachs overlay sits on top while paying; clicks in it aren't
        // "outside" this panel.
        onInteractOutside={(event) => {
          if (paying) event.preventDefault();
        }}
        className="flex max-h-[min(52rem,calc(100dvh-4rem-var(--maintenance-banner-height,0px)))] flex-col gap-0 overflow-hidden border-border/30 p-0 shadow-2xl max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-h-[90dvh] max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 sm:max-w-[480px] sm:rounded-xl"
      >
        {/* Grab handle on the bottom sheet; tapping outside or Escape closes it. */}
        <div
          aria-hidden="true"
          className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/30 sm:hidden"
        />
        <DialogTitle className="sr-only">Checkout</DialogTitle>
        <DialogDescription className="sr-only">
          Upgrade {organizationLabel} to {plan.name}
        </DialogDescription>

        <button
          type="button"
          onClick={() => handleOpenChange(false)}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 hidden size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:flex"
        >
          <X className="size-4" aria-hidden="true" />
        </button>

        {/* One column: the price, what the plan includes, then the payment. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <PlanPrice
            tier={checkoutTier}
            amount={dueNow}
            interval={checkoutInterval}
            organizationLabel={organizationLabel}
            planName={plan.name}
          />
          <PlanFeatures
            planName={plan.name}
            features={plan.features}
            reason={reason}
          />
          {checkoutMode === "review" && (
            <CheckoutSummary
              availablePlans={availablePlans}
              locked={paying}
              interval={checkoutInterval}
              selectedTier={selectedTier}
              setInterval={setInterval}
              setSelectedTier={setSelectedTier}
            />
          )}
          <PaymentPanel
            error={error}
            inNaira={inNaira}
            totals={totals}
            action={
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs"
                onClick={subscribe}
                disabled={paying || availablePlans.length === 0}
              >
                {paying ? (
                  <>
                    <Spinner className="size-3.5 animate-spin" aria-hidden="true" />
                    Opening
                  </>
                ) : (
                  "Subscribe"
                )}
              </Button>
            }
          />
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

/**
 * What the plan includes. When the dialog opened because of a limit, that
 * feature comes first, marked, so the user sees what they're unlocking.
 */
function PlanFeatures({
  planName,
  features,
  reason,
}: {
  planName: string;
  features: readonly string[];
  reason?: string;
}) {
  const highlight = isUpgradeReason(reason) ? UPGRADE_REASONS[reason] : null;
  const ordered = highlight && features.includes(highlight)
    ? [highlight, ...features.filter((feature) => feature !== highlight)]
    : features;

  return (
    <section aria-label={`${planName} includes`} className="px-5 pt-8 sm:px-8 lg:px-10">
      <h3 className="mb-3 text-xs font-medium">{planName} includes</h3>
      <ul className="space-y-2 text-xs">
        {ordered.map((feature) => {
          const unlocking = feature === highlight;
          return (
            <li
              key={feature}
              className={cn(
                "flex items-start gap-2.5",
                unlocking && "-mx-2.5 rounded-md bg-foreground/[0.06] px-2.5 py-2",
              )}
            >
              <Check
                className={cn("mt-0.5 size-3.5 shrink-0", unlocking ? "text-foreground" : "text-muted-foreground")}
                aria-hidden="true"
              />
              <span className={cn("leading-5", unlocking ? "font-medium text-foreground" : "text-foreground/85")}>
                {feature}
                {unlocking && (
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    What you just tried to use
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
        Model usage stays pay as you go.{" "}
        <Link href="/pricing" target="_blank" className="underline underline-offset-2 hover:text-foreground">
          Compare plans
        </Link>
      </p>
    </section>
  );
}

/** "Upgrade {org} to {plan}" and the price, at the top of the payment panel. */
function PlanPrice({
  amount,
  interval,
  organizationLabel,
  planName,
  tier,
}: {
  amount: number;
  interval: PlanBillingInterval;
  organizationLabel: string;
  planName: string;
  tier: PaidPlanTier;
}) {
  const price = usePlanPrice(tier);
  return (
    <div className="px-5 pt-6 text-center sm:px-8 sm:pt-8 lg:px-10 lg:pt-10">
      <p className="text-sm text-muted-foreground">
        Upgrade {organizationLabel} to {planName}
      </p>
      <div className="mt-1.5 flex items-center justify-center gap-3">
        <span className="text-4xl font-semibold tracking-[-0.035em] tabular-nums">
          {price.format(amount)}
        </span>
        <span className="text-left text-xs font-medium leading-4 text-muted-foreground">
          per
          <br />
          {interval}
        </span>
      </div>
    </div>
  );
}

/** Review mode only: the billing-cycle toggle and plan picker, under the price. */
function CheckoutSummary({
  availablePlans,
  locked,
  interval,
  selectedTier,
  setInterval,
  setSelectedTier,
}: {
  availablePlans: PaidPlanTier[];
  /** While a checkout is open, the choice can't change. */
  locked: boolean;
  interval: PlanBillingInterval;
  selectedTier: PaidPlanTier;
  setInterval: (interval: PlanBillingInterval) => void;
  setSelectedTier: (tier: PaidPlanTier) => void;
}) {
  const price = usePlanPrice(selectedTier);
  return (
    <div className="space-y-8 px-5 pt-8 sm:px-8 lg:px-10">
      <section aria-labelledby="billing-cycle-heading">
        <div className="mb-3 flex items-center justify-between">
          <h3 id="billing-cycle-heading" className="text-xs font-medium">
            Billing cycle
          </h3>
          <span className="text-[11px] text-emerald-500">
            Two months free annually
          </span>
        </div>
        <div className="grid grid-cols-2 rounded-md border border-border/60 bg-secondary/20 p-1">
          {(["month", "year"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={interval === value}
              onClick={() => setInterval(value)}
              disabled={locked}
              className={cn(
                "h-8 rounded text-xs font-medium transition-[background-color,color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-[0.99] disabled:cursor-default",
                interval === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "month" ? "Monthly" : "Annual"}
            </button>
          ))}
        </div>
      </section>

      {availablePlans.length > 1 && (
        <section aria-labelledby="plan-heading">
          <h3 id="plan-heading" className="mb-3 text-xs font-medium">
            Plan
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {availablePlans.map((tier) => {
              const option = CENCORI_PAID_PLANS[tier];
              const selected = selectedTier === tier;
              const optionMonthly = getMonthlyEquivalentCents(tier, interval);

              return (
                <button
                  key={tier}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedTier(tier)}
                  disabled={locked}
                  className={cn(
                    "group rounded-lg border px-4 py-3.5 text-left transition-[border-color,background-color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-[0.99] disabled:cursor-default",
                    selected
                      ? "border-foreground/35 bg-foreground/[0.035]"
                      : "border-border/60 hover:border-border hover:bg-secondary/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{option.name}</p>
                    <p className="text-sm font-medium tabular-nums">
                      {price.format(optionMonthly)}
                      <span className="text-[10px] font-normal text-muted-foreground">
                        {" "}
                        /mo
                      </span>
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

/** The subtotal and total due today, under the payment note. */
function OrderTotals({
  dueNow,
  inNaira,
  interval,
  tier,
}: {
  dueNow: number;
  inNaira: boolean;
  interval: PlanBillingInterval;
  tier: PaidPlanTier;
}) {
  const price = usePlanPrice(tier);
  // Charged in the currency shown: the naira price, or the dollar price.
  const total = inNaira ? price.format(dueNow) : formatCents(dueNow);

  return (
    <dl className="text-sm">
      <div className="flex items-center justify-between gap-6 pb-3">
        <dt>Subtotal</dt>
        <dd className="tabular-nums">{total}</dd>
      </div>
      <div className="flex items-end justify-between gap-6 border-t border-border/50 pt-3">
        <dt>
          <span className="block font-medium">Total due today</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {inNaira
              ? `Covers one ${interval}. Renew from Billing before it ends.`
              : `Renews every ${interval} until you cancel.`}{" "}
            A payment processing fee is added at checkout.
          </span>
        </dt>
        <dd className="text-lg font-semibold tabular-nums">{total}</dd>
      </div>
    </dl>
  );
}

/** The bar pinned to the bottom of the payment panel: the button, with the authorization note under it. */
function PanelFooter({
  action,
  children,
}: {
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="sticky bottom-0 flex flex-col items-center gap-2 border-t border-border/30 bg-background px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8 lg:px-10">
      <div className="shrink-0">{action}</div>
      <p className="text-center text-[11px] leading-4 text-muted-foreground">{children}</p>
    </div>
  );
}

function CheckoutError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-red-500/25 bg-red-500/[0.06] px-3 py-2.5 text-xs leading-5 text-red-500"
    >
      {message}
    </div>
  );
}
