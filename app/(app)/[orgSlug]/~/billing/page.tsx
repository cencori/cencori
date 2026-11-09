"use client";

import React, { useEffect, useState, use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { supabase } from '@/lib/supabaseClient';
import { useSearchParams } from 'next/navigation';
import { getInvoices } from './actions';
import { CreditCard, Info } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";
import Link from 'next/link';
import { UpgradeDialog } from "@/components/billing/UpgradeDialog";
import { CurrencyToggle } from "@/components/dashboard/CurrencyToggle";
import { CENCORI_PAID_PLANS, isPaidPlanTier, type PaidPlanTier } from '@/lib/billing/plans';
import { isNairaPassOrg } from '@/lib/billing/naira-plan-pass';
import { forgetPendingCheckout, readPendingCheckout, startBachsCheckout } from '@/lib/billing/bachs-overlay';

import { PlanDetails } from "@/components/dashboard/billing/PlanDetails";
import { CostControl } from "@/components/dashboard/billing/CostControl";
import { CreditBalance } from "@/components/dashboard/billing/CreditBalance";
import { InvoiceHistory } from "@/components/dashboard/billing/InvoiceHistory";
import { BillingCommunication } from "@/components/dashboard/billing/BillingCommunication";
import { BillingPortal } from "@/components/dashboard/billing/BillingPortal";
import { OperationalControls } from "./OperationalControls";
import { BusinessPlan, useBusinessPlan } from "@/components/dashboard/billing/BusinessPlan";

interface Organization {
    id: string;
    slug: string;
    name: string;
    subscription_tier: 'free' | 'pro' | 'team' | 'enterprise';
    subscription_status: string;
    monthly_requests_used: number;
    subscription_current_period_end: string | null;
    billing_provider: string | null;
    subscription_id: string | null;
    bachs_customer_id: string | null;
    credits_balance: number;
    billing_email: string;
    billing_address_line1: string | null;
    billing_address_line2: string | null;
    billing_city: string | null;
    billing_state: string | null;
    billing_zip: string | null;
    billing_country: string | null;
    billing_tax_id: string | null;
}

interface ProjectData {
    id: string;
    slug: string;
    name: string;
    monthly_budget: number | null;
    spend_cap: number | null;
    enforce_spend_cap: boolean;
}

interface PageProps {
    params: Promise<{ orgSlug: string }>;
}

interface CreditTransaction {
    id: string;
    amount: number;
    transaction_type: string;
    description: string | null;
    created_at: string;
}

function useBillingData(orgSlug: string) {
    const orgQuery = useQuery({
        queryKey: ["orgBilling", orgSlug],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('organizations')
                .select('id, name, subscription_tier, subscription_status, monthly_requests_used, subscription_current_period_end, billing_provider, subscription_id, bachs_customer_id, credits_balance, billing_email, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_zip, billing_country, billing_tax_id')
                .eq('slug', orgSlug)
                .single();

            if (error || !data) throw new Error("Organization not found");
            return data as Organization;
        },
        staleTime: 30 * 1000,
    });

    const projectsQuery = useQuery({
        queryKey: ["orgProjectsBilling", orgQuery.data?.id],
        enabled: !!orgQuery.data?.id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('projects')
                .select('id, slug, name, monthly_budget, spend_cap, enforce_spend_cap')
                .eq('organization_id', orgQuery.data!.id);

            if (error) throw error;
            return data as ProjectData[];
        },
    });

    const creditsQuery = useQuery({
        queryKey: ["orgCredits", orgQuery.data?.id],
        enabled: !!orgQuery.data?.id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('credit_transactions')
                .select('*')
                .eq('organization_id', orgQuery.data!.id)
                .order('created_at', { ascending: false })
                .limit(5);

            if (error) return [];
            return (data || []) as CreditTransaction[];
        },
    });

    const invoicesQuery = useQuery({
        queryKey: ["orgInvoices", orgSlug],
        queryFn: () => getInvoices(orgSlug)
    });

    return {
        org: orgQuery.data,
        projects: projectsQuery.data || [],
        transactions: creditsQuery.data || [],
        invoices: invoicesQuery.data || [],
        isLoading: orgQuery.isLoading
            || projectsQuery.isLoading
            || invoicesQuery.isLoading,
        refetchOrg: orgQuery.refetch,
        error: orgQuery.error
            || projectsQuery.error
            || invoicesQuery.error
    };
}

type CheckoutNotice =
    | { kind: 'confirming'; expectedTier: PaidPlanTier | null; previousPeriodEnd: string | null }
    | { kind: 'cancelled' }
    | null;

export default function BillingPage({ params }: PageProps) {
    const { orgSlug } = use(params);
    const searchParams = useSearchParams();
    const [checkoutNotice, setCheckoutNotice] = useState<CheckoutNotice>(null);
    const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
    const [renewing, setRenewing] = useState(false);
    const [renewError, setRenewError] = useState<string | null>(null);
    const [openingPortal, setOpeningPortal] = useState(false);
    const { org, projects, transactions, invoices, isLoading, error, refetchOrg } = useBillingData(orgSlug);
    const businessPlan = useBusinessPlan(org?.id);
    const checkoutId = searchParams.get('checkout_session_id') || searchParams.get('checkout_id');
    const checkoutCancelled = searchParams.get('checkout') === 'cancelled';
    // Confirmed once the webhook has applied the payment: the plan is on, and
    // for a renewal the paid period has moved past where it was before paying.
    const checkoutConfirmed = checkoutNotice?.kind === 'confirming'
        && checkoutNotice.expectedTier !== null
        && org?.subscription_tier === checkoutNotice.expectedTier
        && org.subscription_status === 'active'
        && (checkoutNotice.previousPeriodEnd === null
            || org.subscription_current_period_end !== checkoutNotice.previousPeriodEnd);

    useEffect(() => {
        if (checkoutId) {
            const pending = readPendingCheckout(checkoutId);
            setCheckoutNotice({
                kind: 'confirming',
                expectedTier: isPaidPlanTier(pending?.tier) ? pending.tier : null,
                previousPeriodEnd: pending?.previousPeriodEnd ?? null,
            });

            // Card payments land in seconds; bank transfers can take a minute.
            void refetchOrg();
            const refreshTimer = window.setInterval(() => void refetchOrg(), 3_000);
            const stopTimer = window.setTimeout(() => window.clearInterval(refreshTimer), 90_000);
            window.history.replaceState({}, '', window.location.pathname);

            return () => {
                window.clearInterval(refreshTimer);
                window.clearTimeout(stopTimer);
            };
        }

        if (checkoutCancelled) {
            setCheckoutNotice({ kind: 'cancelled' });
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [checkoutCancelled, checkoutId, refetchOrg]);

    useEffect(() => {
        if (checkoutConfirmed && checkoutId) forgetPendingCheckout(checkoutId);
    }, [checkoutConfirmed, checkoutId]);

    const paidTier = org?.subscription_tier === 'pro' || org?.subscription_tier === 'team';
    // Pro paid in naira is prepaid: renew it here (another month, added to
    // the end of the current one).
    const nairaPro = isNairaPassOrg(org);
    // A Pro subscription by card on Bachs: managed in the Bachs portal.
    const cardSubscription = paidTier && org?.billing_provider === 'bachs' && Boolean(org.subscription_id);
    // Still on the retired Stripe billing: subscribing on Bachs moves it.
    const legacyStripe = paidTier && org?.billing_provider === 'stripe';
    const canSubscribe = org?.subscription_tier === 'free' || legacyStripe;

    const renewNairaPro = async () => {
        if (!org || renewing) return;
        setRenewing(true);
        setRenewError(null);
        try {
            const done = await startBachsCheckout({
                endpoint: '/api/billing/checkout/naira',
                body: { orgId: org.id, interval: 'month' },
                tier: 'pro',
                orgSlug,
                previousPeriodEnd: org.subscription_current_period_end,
            });
            if (!done) setRenewing(false);
        } catch (renewError) {
            setRenewError(renewError instanceof Error ? renewError.message : "Couldn't open checkout. Try again.");
            setRenewing(false);
        }
    };

    const openBillingPortal = async () => {
        if (!org || openingPortal) return;
        setOpeningPortal(true);
        setRenewError(null);
        try {
            const response = await fetch('/api/billing/portal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orgId: org.id }),
            });
            const data = await response.json().catch(() => ({})) as { url?: string; error?: string };
            if (!response.ok || !data.url) throw new Error(data.error || "Couldn't open the billing portal. Try again.");
            window.location.assign(data.url);
        } catch (portalError) {
            setRenewError(portalError instanceof Error ? portalError.message : "Couldn't open the billing portal. Try again.");
            setOpeningPortal(false);
        }
    };

    const planAction = canSubscribe
        ? { label: legacyStripe ? 'Renew Pro' : 'Upgrade Plan', onAction: () => setShowUpgradeDialog(true) }
        : nairaPro
            ? { label: renewing ? 'Opening…' : 'Renew in naira', onAction: () => void renewNairaPro() }
            : cardSubscription
                ? { label: openingPortal ? 'Opening…' : 'Manage subscription', onAction: () => void openBillingPortal() }
                : { label: 'Current Plan', onAction: undefined };

    // Mapping for project budget format
    const formattedProjects = projects.map(p => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        monthlyBudget: p.monthly_budget,
        spendCap: p.spend_cap,
        enforceSpendCap: p.enforce_spend_cap,
        currentSpend: 0
    }));

    // Mapping for credits format
    const formattedTransactions = transactions.map((t) => ({
        id: t.id,
        amount: t.amount,
        type: t.transaction_type,
        description: t.description || 'No description',
        createdAt: t.created_at
    }));

    return (
        <main className="mx-auto w-full max-w-[1180px] px-0 pb-6 pt-0 sm:px-6 sm:pt-4 lg:px-8 lg:pt-6">
            <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-base font-medium">Billing</h1>
                    <p className="mt-0.5 max-w-[60ch] text-xs text-muted-foreground">
                        Plans, prepaid capacity, and spend controls for {org?.name ?? "your organization"}.
                    </p>
                </div>
                <CurrencyToggle />
            </header>
            <AnimatePresence>
                {checkoutNotice && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="mb-6"
                    >
                        <div className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 ${
                            checkoutNotice.kind === 'cancelled'
                                ? 'border-border bg-secondary/20 text-muted-foreground'
                                : checkoutConfirmed
                                    ? 'border-emerald-500/20 bg-emerald-500/[0.03] text-emerald-600 dark:text-emerald-400'
                                    : 'border-amber-500/20 bg-amber-500/[0.03] text-amber-600 dark:text-amber-400'
                        }`}>
                            <div className="text-xs font-medium">
                                {checkoutNotice.kind === 'cancelled'
                                    ? 'Checkout cancelled — no changes were made'
                                    : checkoutConfirmed
                                        ? 'Subscription active — your new plan is ready'
                                        : 'Payment submitted — activating your subscription'}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {isLoading ? (
                <div className="space-y-6 text-current/[0.1]">
                    <Skeleton className="h-72 rounded-[18px] bg-current/5" />
                    <Skeleton className="h-72 rounded-[18px] bg-current/5" />
                    <Skeleton className="h-56 rounded-[18px] bg-current/5" />
                    <Skeleton className="h-64 rounded-[18px] bg-current/5" />
                    <Skeleton className="h-80 rounded-[18px] bg-current/5" />
                </div>
            ) : error || !org ? (
                <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                    <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/[0.03] text-destructive/60">
                        <CreditCard className="h-8 w-8" />
                    </div>
                    <h2 className="text-lg font-medium tracking-tight">Billing unavailable</h2>
                    <p className="max-w-[280px] text-center text-xs leading-5 text-muted-foreground">
                        Cencori could not load this organization&apos;s billing data. Check your connection and try again.
                    </p>
                    <Button
                        variant="outline"
                        className="h-7 rounded-md px-3 text-[11px] font-medium shadow-none"
                        onClick={() => window.location.reload()}
                    >
                        Try again
                    </Button>
                </div>
            ) : businessPlan.data?.account_type === "business" ? (
            <div>
                <div data-copilot-spot="business_plan">
                    <BusinessPlan orgId={org.id} data={businessPlan.data} />
                </div>
                <BillingCommunication
                    orgSlug={orgSlug}
                    email={org.billing_email || ''}
                    address={{
                        name: org.name,
                        line1: org.billing_address_line1 || '',
                        line2: org.billing_address_line2 || '',
                        city: org.billing_city || '',
                        state: org.billing_state || '',
                        zip: org.billing_zip || '',
                        country: org.billing_country || '',
                        taxId: org.billing_tax_id || ''
                    }}
                />
                <div data-copilot-spot="invoices">
                    <InvoiceHistory invoices={invoices} />
                </div>
            </div>
            ) : (
            <div>
                <div data-copilot-spot="plan">
                    {legacyStripe && (
                        <div className="mb-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                            We&apos;ve moved billing to a new payment provider, and your old card subscription won&apos;t renew.
                            {org.subscription_current_period_end
                                ? <> Pro stays on until {new Date(org.subscription_current_period_end).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}.</>
                                : null}{' '}
                            Renew Pro here to keep it after that.
                        </div>
                    )}
                    {renewError && (
                        <div role="alert" className="mb-3 rounded-md border border-red-500/25 bg-red-500/[0.06] px-3 py-2.5 text-xs text-red-500">
                            {renewError}
                        </div>
                    )}
                    <PlanDetails
                        tier={org.subscription_tier}
                        status={org.subscription_status}
                        currentPeriodEnd={org.subscription_current_period_end}
                        price={isPaidPlanTier(org.subscription_tier) ? CENCORI_PAID_PLANS[org.subscription_tier].prices.month / 100 : 0}
                        monthlyRequestsUsed={org.monthly_requests_used}
                        projectCount={projects.length}
                        projectLimit={org.subscription_tier === 'free' ? 1 : 999999}
                        creditBalance={org.credits_balance || 0}
                        actionLabel={planAction.label}
                        onAction={planAction.onAction}
                    />
                </div>

                <div data-copilot-spot="credits">
                    <CreditBalance
                        orgId={org.id}
                        balance={org.credits_balance || 0}
                        transactions={formattedTransactions}
                    />
                </div>

                <div data-copilot-spot="payment_methods">
                    <BillingPortal
                        hasAccount={Boolean(org.bachs_customer_id)}
                        opening={openingPortal}
                        onOpen={() => void openBillingPortal()}
                    />
                </div>

                <BillingCommunication
                    orgSlug={orgSlug}
                    email={org.billing_email || ''}
                    address={{
                        name: org.name,
                        line1: org.billing_address_line1 || '',
                        line2: org.billing_address_line2 || '',
                        city: org.billing_city || '',
                        state: org.billing_state || '',
                        zip: org.billing_zip || '',
                        country: org.billing_country || '',
                        taxId: org.billing_tax_id || ''
                    }}
                />

                <CostControl orgSlug={orgSlug} projects={formattedProjects} />

                <div data-copilot-spot="invoices">
                    <InvoiceHistory invoices={invoices} />
                </div>

                <OperationalControls orgSlug={orgSlug} />

                <UpgradeDialog
                    open={showUpgradeDialog}
                    onOpenChange={setShowUpgradeDialog}
                    orgId={org.id}
                    orgSlug={orgSlug}
                    orgName={org.name}
                    currentTier={canSubscribe ? 'free' : paidTier ? org.subscription_tier as PaidPlanTier : 'free'}
                />

                <div className="flex flex-col gap-4 border-t border-border/30 py-8 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div>
                            <div className="text-xs font-medium">Need a custom billing arrangement?</div>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Talk to us about enterprise contracts, annual billing, and custom invoicing.
                            </p>
                        </div>
                    </div>
                    <Button asChild className="h-7 rounded-md px-3 text-[11px] font-medium shadow-none">
                        <Link href="mailto:support@cencori.com">Contact billing</Link>
                    </Button>
                </div>
            </div>
            )}
        </main>
    );
}
