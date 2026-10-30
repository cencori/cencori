"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { loadStripe } from "@stripe/stripe-js";
import {
  BillingAddressElement,
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import { ArrowRight, CreditCard } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CENCORI_PAID_PLANS,
  getAvailableUpgradePlans,
  getMonthlyEquivalentCents,
  type PaidPlanTier,
  type PlanBillingInterval,
} from "@/lib/billing/plans";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgSlug: string;
  orgName?: string;
  currentTier?: "free" | PaidPlanTier;
  /** Kept so existing callers compile; the checkout no longer shows it. */
  reason?: string;
  recommendedTier?: PaidPlanTier;
  checkoutMode?: "review" | "direct";
  preload?: boolean;
  returnPath?: string;
}

type PlanChangePreview = {
  amountDue: number;
  currency: string;
  interval: PlanBillingInterval;
  prorationDate: number;
  card: { brand: string; last4: string } | null;
};

type CheckoutResponse = {
  clientSecret?: string;
  sessionId?: string;
  error?: string;
};

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : null;

function formatCents(cents: number, maximumFractionDigits = 2): string {
  return formatCurrency(cents / 100, "USD", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
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

function getSafeReturnPath(orgSlug: string, returnPath?: string): string {
  return returnPath?.startsWith("/") && !returnPath.startsWith("//")
    ? returnPath
    : `/${encodeURIComponent(orgSlug)}/~/billing`;
}

function getReturnUrl(
  orgSlug: string,
  sessionId: string,
  returnPath?: string,
): string {
  const returnUrl = new URL(
    getSafeReturnPath(orgSlug, returnPath),
    window.location.origin,
  );
  returnUrl.searchParams.set("checkout_session_id", sessionId);
  return returnUrl.toString();
}

function PaymentForm({
  error,
  orgSlug,
  returnPath,
  sessionId,
  onError,
  onSubmittingChange,
  totals,
}: {
  error: string | null;
  orgSlug: string;
  returnPath?: string;
  sessionId: string;
  onError: (message: string | null) => void;
  onSubmittingChange: (submitting: boolean) => void;
  totals: ReactNode;
}) {
  const checkoutState = useCheckoutElements();
  const [paymentReady, setPaymentReady] = useState(false);
  const [billingAddressReady, setBillingAddressReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (checkoutState.type === "error") {
      onError(checkoutState.error.message);
    }
  }, [checkoutState, onError]);

  const confirmPayment = async () => {
    if (checkoutState.type !== "success" || submitting) return;

    setSubmitting(true);
    onSubmittingChange(true);
    onError(null);

    try {
      const confirmRequest = checkoutState.checkout.confirm({
        redirect: "if_required",
        returnUrl: getReturnUrl(orgSlug, sessionId, returnPath),
      });
      const timeout = new Promise<never>((_, reject) => {
        window.setTimeout(() => {
          reject(
            new Error(
              "Payment confirmation timed out. Check your connection and try again — you have not been charged twice.",
            ),
          );
        }, 60_000);
      });
      const result = await Promise.race([confirmRequest, timeout]);

      if (result.type === "error") {
        onError(
          result.error.message || "Payment could not be completed. Try again.",
        );
        setSubmitting(false);
        onSubmittingChange(false);
        return;
      }

      try {
        window.location.assign(
          getReturnUrl(orgSlug, result.session.id || sessionId, returnPath),
        );
      } catch (redirectError) {
        onError(
          redirectError instanceof Error
            ? redirectError.message
            : "Payment succeeded but redirect failed. Refresh the billing page to confirm activation.",
        );
        setSubmitting(false);
        onSubmittingChange(false);
        return;
      }

      // Safety net: if navigation is blocked (CSP/popup blocker) reset so the
      // button doesn't stay on "Processing" forever.
      window.setTimeout(() => {
        setSubmitting(false);
        onSubmittingChange(false);
      }, 5_000);
    } catch (confirmError) {
      onError(
        confirmError instanceof Error
          ? confirmError.message
          : "Payment could not be completed. Try again.",
      );
      setSubmitting(false);
      onSubmittingChange(false);
    }
  };

  const canConfirm =
    checkoutState.type === "success" &&
    checkoutState.checkout.canConfirm &&
    paymentReady &&
    billingAddressReady &&
    !submitting;

  return (
    <PaymentPanel
      error={error}
      loading={checkoutState.type === "loading"}
      totals={totals}
      action={
        <Button
          type="button"
          size="sm"
          className="h-7 text-xs"
          onClick={confirmPayment}
          disabled={!canConfirm}
        >
          {submitting ? (
            <>
              <Spinner className="size-3.5 animate-spin" aria-hidden="true" />
              Processing
            </>
          ) : (
            "Subscribe"
          )}
        </Button>
      }
    >
      {checkoutState.type === "success" && (
        <>
          <PaymentElement
            options={{
              layout: "tabs",
              paymentMethodOrder: ["card"],
              fields: {
                billingDetails: "never",
              },
              wallets: {
                applePay: "never",
                googlePay: "never",
                link: "never",
              },
              // The panel has its own authorization note above the button.
              terms: { card: "never" },
            }}
            onReady={() => setPaymentReady(true)}
            onChange={() => onError(null)}
            onLoadError={(event) =>
              onError(
                event.error.message || "The payment form could not be loaded.",
              )
            }
          />
          <BillingAddressElement
            options={{
              display: { name: "full" },
            }}
            onReady={() => setBillingAddressReady(true)}
            onChange={() => onError(null)}
            onLoadError={(event) =>
              onError(
                event.error.message ||
                  "The billing address form could not be loaded.",
              )
            }
          />
        </>
      )}
    </PaymentPanel>
  );
}

/**
 * The right half of the checkout card: the card and billing fields, the
 * totals, and the footer with the authorization note and the button. Rendered with skeletons while the Stripe session is being created.
 */
function PaymentPanel({
  action,
  children,
  error,
  loading,
  totals,
}: {
  action: ReactNode;
  children?: ReactNode;
  error: string | null;
  loading: boolean;
  totals: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-8 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <section aria-label="Payment details">
          <div className="space-y-5">
            {loading ? (
              <div className="space-y-4" aria-label="Loading payment form">
                <Skeleton className="h-11 w-full rounded-md" />
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-11 rounded-md" />
                  <Skeleton className="h-11 rounded-md" />
                </div>
                <Skeleton className="h-11 w-full rounded-md" />
                <Skeleton className="h-11 w-full rounded-md" />
              </div>
            ) : (
              children
            )}
          </div>
        </section>

        {totals}

        {error && <CheckoutError message={error} />}
      </div>

      <PanelFooter action={action}>
        By subscribing, you authorize Cencori to charge you according to the{" "}
        <Link
          href="/terms-of-service"
          className="underline underline-offset-2 hover:text-foreground"
        >
          terms
        </Link>{" "}
        until you cancel. See our{" "}
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
}: UpgradeDialogProps) {
  const { resolvedTheme } = useTheme();
  const availablePlans = useMemo(
    () => getAvailableUpgradePlans(currentTier),
    [currentTier],
  );
  const directTier = getInitialTier(currentTier, recommendedTier);
  const [selectedTier, setSelectedTier] = useState<PaidPlanTier>(directTier);
  const [interval, setInterval] = useState<PlanBillingInterval>("month");
  const [creatingSession, setCreatingSession] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasOpened, setHasOpened] = useState(false);
  const directCheckoutStartedRef = useRef(false);
  const checkoutIdempotencyKeyRef = useRef<string | null>(null);
  const checkoutOrgIdRef = useRef(orgId);

  // Already paying: the existing subscription moves to the new plan (charged
  // to the card on file) instead of starting a second one through Checkout.
  const changingPlan = currentTier !== "free";
  const [planChange, setPlanChange] = useState<PlanChangePreview | null>(null);
  const [planChangeLoading, setPlanChangeLoading] = useState(false);

  const checkoutTier =
    checkoutMode === "direct" || changingPlan ? directTier : selectedTier;
  const checkoutInterval = changingPlan
    ? (planChange?.interval ?? "month")
    : checkoutMode === "direct"
      ? "month"
      : interval;
  const plan = CENCORI_PAID_PLANS[checkoutTier];
  const dueNow = plan.prices[checkoutInterval];
  const organizationLabel = orgName || orgSlug || "your organization";

  const resetCheckout = useCallback(() => {
    directCheckoutStartedRef.current = false;
    checkoutIdempotencyKeyRef.current = null;
    setCreatingSession(false);
    setPaymentSubmitting(false);
    setClientSecret(null);
    setSessionId(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelectedTier(directTier);
    if (checkoutMode === "direct") setInterval("month");
    setError(null);
  }, [checkoutMode, directTier, open]);

  useEffect(() => {
    if (open) setHasOpened(true);
  }, [open]);

  useEffect(() => {
    checkoutIdempotencyKeyRef.current = null;
  }, [checkoutInterval, checkoutTier]);

  useEffect(() => {
    if (checkoutOrgIdRef.current === orgId) return;
    checkoutOrgIdRef.current = orgId;
    resetCheckout();
  }, [orgId, resetCheckout]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && (creatingSession || paymentSubmitting)) return;
    if (!nextOpen && checkoutMode === "review") resetCheckout();
    if (!nextOpen && checkoutMode === "direct") {
      setPaymentSubmitting(false);
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const startCheckout = useCallback(async () => {
    if (creatingSession || clientSecret) return;
    if (!stripePromise) {
      setError("Checkout is not configured yet. Please contact support.");
      return;
    }
    if (!orgId) {
      setError(
        "We couldn't identify this organization. Refresh and try again.",
      );
      return;
    }

    setCreatingSession(true);
    setError(null);

    try {
      if (!checkoutIdempotencyKeyRef.current) {
        checkoutIdempotencyKeyRef.current =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Checkout-Idempotency-Key": checkoutIdempotencyKeyRef.current,
        },
        body: JSON.stringify({
          tier: checkoutTier,
          interval: checkoutInterval,
          orgId,
        }),
      });

      const contentType = response.headers.get("content-type") || "";
      const data: CheckoutResponse = contentType.includes("application/json")
        ? await response.json()
        : {
            error:
              "Checkout returned an unexpected response. Please try again.",
          };

      if (!response.ok || !data.clientSecret || !data.sessionId) {
        throw new Error(data.error || "Secure checkout could not be started.");
      }

      sessionStorage.setItem(
        `cencori:stripe-checkout:${data.sessionId}`,
        checkoutTier,
      );
      setClientSecret(data.clientSecret);
      setSessionId(data.sessionId);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Secure checkout could not be started.",
      );
    } finally {
      setCreatingSession(false);
    }
  }, [checkoutInterval, checkoutTier, clientSecret, creatingSession, orgId]);

  useEffect(() => {
    if (!open && !preload) return;
    if (
      checkoutMode !== "direct" ||
      changingPlan ||
      directCheckoutStartedRef.current
    )
      return;
    directCheckoutStartedRef.current = true;
    void startCheckout();
  }, [changingPlan, checkoutMode, open, preload, startCheckout]);

  const loadPlanChange = useCallback(async () => {
    setPlanChangeLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/subscription/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, tier: checkoutTier }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          data.error || "The upgrade couldn't be priced. Try again.",
        );
      setPlanChange(data as PlanChangePreview);
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : "The upgrade couldn't be priced. Try again.",
      );
    } finally {
      setPlanChangeLoading(false);
    }
  }, [checkoutTier, orgId]);

  useEffect(() => {
    if (!open || !changingPlan) return;
    setPlanChange(null);
    void loadPlanChange();
  }, [changingPlan, loadPlanChange, open]);

  const confirmPlanChange = async () => {
    if (!planChange || paymentSubmitting) return;
    setPaymentSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/subscription/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          tier: checkoutTier,
          confirm: true,
          prorationDate: planChange.prorationDate,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          data.error || "The upgrade couldn't be completed. Try again.",
        );
      window.location.assign(getSafeReturnPath(orgSlug, returnPath));
    } catch (upgradeError) {
      setError(
        upgradeError instanceof Error
          ? upgradeError.message
          : "The upgrade couldn't be completed. Try again.",
      );
      setPaymentSubmitting(false);
    }
  };

  const checkoutOptions = useMemo(
    () =>
      clientSecret
        ? {
            clientSecret,
            elementsOptions: {
              appearance: {
                theme:
                  resolvedTheme === "light"
                    ? ("stripe" as const)
                    : ("night" as const),
                // Joined fields in one rounded block (card number over expiry |
                // CVC; name over country over address): faint lines between
                // fields, a label over each block and grey placeholders inside.
                inputs: "condensed" as const,
                labels: "above" as const,
                variables: {
                  colorPrimary:
                    resolvedTheme === "light" ? "#111111" : "#ffffff",
                  colorBackground:
                    resolvedTheme === "light" ? "#ffffff" : "#0f0f0f",
                  colorText: resolvedTheme === "light" ? "#111111" : "#f5f5f5",
                  colorDanger: "#ef4444",
                  borderRadius: "10px",
                  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
                  fontSizeBase: "13px",
                  spacingUnit: "4px",
                  colorTextPlaceholder:
                    resolvedTheme === "light" ? "#8a8a8a" : "#636363",
                },
                rules: {
                  ".Input": {
                    backgroundColor:
                      resolvedTheme === "light" ? "#f5f5f5" : "#0f0f0f",
                    // Stripe draws the outer edge and the lines between fields
                    // as one border, so one faint shade for both.
                    borderColor:
                      resolvedTheme === "light" ? "#e5e5e5" : "#222222",
                    boxShadow: "none",
                    padding: "9px 14px",
                  },
                  ".Input:focus": {
                    borderColor:
                      resolvedTheme === "light" ? "#a3a3a3" : "#404040",
                    boxShadow: "none",
                  },
                },
              },
            },
          }
        : null,
    [clientSecret, resolvedTheme],
  );

  const summary = (
    <CheckoutSummary
      availablePlans={availablePlans}
      clientSecret={clientSecret}
      interval={checkoutInterval}
      selectedTier={selectedTier}
      setInterval={setInterval}
      setSelectedTier={setSelectedTier}
    />
  );

  const totals = (
    <OrderTotals
      dueNow={dueNow}
      dueToday={changingPlan ? (planChange?.amountDue ?? null) : dueNow}
      interval={checkoutInterval}
    />
  );

  // Once a Stripe session is loaded, the modal stays mounted (just hidden)
  // when closed, so reopening shows the card form instantly instead of
  // reloading Stripe's fields. Non-modal, because a mounted modal dialog
  // would keep the rest of the page hidden from screen readers.
  const keepMounted = hasOpened && Boolean(clientSecret);
  const ignoreWhileHidden = (event: Event) => {
    if (!open) event.preventDefault();
  };

  // Desktop: a centered modal. Mobile (below sm): a bottom sheet pinned to
  // the bottom edge, full width, rounded only at the top. Either way the
  // scrolling body and pinned footer stack in a flex column capped in height.
  const checkoutModal = (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={false}>
      <DialogContent
        animated={false}
        showOverlay={false}
        showCloseButton={false}
        forceMount={keepMounted || undefined}
        // Opening focuses the close button by default, drawing a focus ring
        // around it; leave focus where it was instead.
        onOpenAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={ignoreWhileHidden}
        onInteractOutside={ignoreWhileHidden}
        className="flex max-h-[min(52rem,calc(100%-4rem-var(--maintenance-banner-height,0px)))] flex-col gap-0 overflow-hidden border-border/60 p-0 shadow-2xl data-[state=closed]:pointer-events-none data-[state=closed]:invisible sm:max-w-[400px] max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-h-[90dvh] max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0"
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

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <PlanPrice
            amount={dueNow}
            interval={checkoutInterval}
            organizationLabel={organizationLabel}
            planName={plan.name}
          />
          {!changingPlan && checkoutMode === "review" && summary}
          {changingPlan ? (
            <CardOnFilePanel
              card={planChange?.card ?? null}
              error={error}
              loading={planChangeLoading}
              totals={totals}
              action={
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={planChange ? confirmPlanChange : loadPlanChange}
                  disabled={planChangeLoading || paymentSubmitting}
                >
                  {paymentSubmitting ? (
                    <>
                      <Spinner
                        className="size-3.5 animate-spin"
                        aria-hidden="true"
                      />
                      Upgrading
                    </>
                  ) : planChange || planChangeLoading ? (
                    `Upgrade to ${plan.name}`
                  ) : (
                    "Try again"
                  )}
                </Button>
              }
            />
          ) : checkoutOptions && sessionId ? (
            <CheckoutElementsProvider
              key={clientSecret}
              stripe={stripePromise}
              options={checkoutOptions}
            >
              <PaymentForm
                error={error}
                orgSlug={orgSlug}
                returnPath={returnPath}
                sessionId={sessionId}
                onError={setError}
                onSubmittingChange={setPaymentSubmitting}
                totals={totals}
              />
            </CheckoutElementsProvider>
          ) : (
            <PaymentPanel
              error={error}
              loading={creatingSession || checkoutMode === "review"}
              totals={totals}
              action={
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={startCheckout}
                  disabled={creatingSession || availablePlans.length === 0}
                >
                  {checkoutMode === "review" ? (
                    <>
                      Continue to payment
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </>
                  ) : creatingSession ? (
                    "Subscribe"
                  ) : (
                    "Try again"
                  )}
                </Button>
              }
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  return checkoutModal;
}

/** "Upgrade {org} to {plan}" and the price, at the top of the payment panel. */
function PlanPrice({
  amount,
  interval,
  organizationLabel,
  planName,
}: {
  amount: number;
  interval: PlanBillingInterval;
  organizationLabel: string;
  planName: string;
}) {
  return (
    <div className="px-5 pt-6 text-center sm:px-8 sm:pt-8 lg:px-10 lg:pt-10">
      <p className="text-sm text-muted-foreground">
        Upgrade {organizationLabel} to {planName}
      </p>
      <div className="mt-1.5 flex items-center justify-center gap-3">
        <span className="text-4xl font-semibold tracking-[-0.035em] tabular-nums">
          {formatCents(amount)}
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

/** The right half when changing plan: the card already on file and the button. */
function CardOnFilePanel({
  action,
  card,
  error,
  loading,
  totals,
}: {
  action: ReactNode;
  card: { brand: string; last4: string } | null;
  error: string | null;
  loading: boolean;
  totals: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-8 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <section aria-label="Payment method">
          <div className="flex items-center gap-3 rounded-lg border border-border/60 p-4 text-sm">
            <CreditCard className="size-4 shrink-0" aria-hidden="true" />
            {loading ? (
              <Skeleton className="h-4 w-36" />
            ) : card ? (
              <span>
                <span className="capitalize">{card.brand}</span>
                <span className="text-muted-foreground"> ending in </span>
                <span className="tabular-nums">{card.last4}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">
                The card on your current subscription
              </span>
            )}
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            To use a different card, update it in Billing first.
          </p>
        </section>

        {totals}

        {error && <CheckoutError message={error} />}
      </div>

      <PanelFooter action={action}>
        By upgrading, you authorize Cencori to charge this card according to the{" "}
        <Link
          href="/terms-of-service"
          className="underline underline-offset-2 hover:text-foreground"
        >
          terms
        </Link>{" "}
        until you cancel. See our{" "}
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

/** Review mode only: the billing-cycle toggle and plan picker, under the price. */
function CheckoutSummary({
  availablePlans,
  clientSecret,
  interval,
  selectedTier,
  setInterval,
  setSelectedTier,
}: {
  availablePlans: PaidPlanTier[];
  clientSecret: string | null;
  interval: PlanBillingInterval;
  selectedTier: PaidPlanTier;
  setInterval: (interval: PlanBillingInterval) => void;
  setSelectedTier: (tier: PaidPlanTier) => void;
}) {
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
              disabled={Boolean(clientSecret)}
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
                  disabled={Boolean(clientSecret)}
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
                      {formatCents(optionMonthly)}
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

/** The subtotal and total due today, under the payment fields. */
function OrderTotals({
  dueNow,
  dueToday,
  interval,
}: {
  dueNow: number;
  /** What's charged now: the price, or the prorated difference when changing plan. null while it loads. */
  dueToday: number | null;
  interval: PlanBillingInterval;
}) {
  const prorated = dueToday !== dueNow;
  const total =
    dueToday === null ? (
      <Skeleton className="inline-block h-5 w-14 align-middle" />
    ) : (
      formatCents(dueToday)
    );

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
            {prorated
              ? `Prorated for the rest of your current billing period, then ${formatCents(dueNow)} per ${interval}`
              : "Taxes, if applicable, are calculated during payment"}
          </span>
        </dt>
        <dd className="text-lg font-semibold tabular-nums">{total}</dd>
      </div>
    </dl>
  );
}

/** The bar pinned to the bottom of the payment panel: the authorization note and the button. */
function PanelFooter({
  action,
  children,
}: {
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="sticky bottom-0 flex items-center justify-between gap-6 border-t border-border/30 bg-background px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8 lg:px-10">
      <p className="text-[11px] leading-4 text-muted-foreground">{children}</p>
      <div className="shrink-0">{action}</div>
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
