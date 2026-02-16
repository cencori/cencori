"use client";

import React, { useEffect, useState, use } from 'react';
import { useQuery } from '@tanstack/react-query';
// Import UI components
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from '@/lib/supabaseClient';
import { useSearchParams } from 'next/navigation';
import { getInvoices, getCustomerPortalUrl } from './actions';
import { CheckCircle, CreditCard, LayoutDashboard, Settings, Info, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";

// Import modular components
import { UsageOverview } from "@/components/dashboard/billing/UsageOverview";
import { PlanDetails } from "@/components/dashboard/billing/PlanDetails";
import { CostControl } from "@/components/dashboard/billing/CostControl";
import { CreditBalance } from "@/components/dashboard/billing/CreditBalance";
import { InvoiceHistory } from "@/components/dashboard/billing/InvoiceHistory";
import { BillingCommunication } from "@/components/dashboard/billing/BillingCommunication";
import { PaymentMethods } from "@/components/dashboard/billing/PaymentMethods";

interface Organization {
    id: string;
    name: string;
    subscription_tier: 'free' | 'pro' | 'team' | 'enterprise';
    subscription_status: string;
    monthly_requests_used: number;
    monthly_request_limit: number;
    subscription_current_period_end: string | null;
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
    name: string;
    monthly_budget: number | null;
    spend_cap: number | null;
    enforce_spend_cap: boolean;
}

interface PageProps {
    params: Promise<{ orgSlug: string }>;
}

function useBillingData(orgSlug: string) {
    const orgQuery = useQuery({
        queryKey: ["orgBilling", orgSlug],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('organizations')
                .select('id, name, subscription_tier, subscription_status, monthly_requests_used, monthly_request_limit, subscription_current_period_end, credits_balance, billing_email, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_zip, billing_country, billing_tax_id')
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
                .select('id, name, monthly_budget, spend_cap, enforce_spend_cap')
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
            return data;
        },
    });

    const invoicesQuery = useQuery({
        queryKey: ["orgInvoices", orgSlug],
        queryFn: () => getInvoices(orgSlug)
    });

    const portalUrlQuery = useQuery({
        queryKey: ["orgPortalUrl", orgSlug],
        queryFn: () => getCustomerPortalUrl(orgSlug)
    });

    return {
        org: orgQuery.data,
        projects: projectsQuery.data || [],
        transactions: creditsQuery.data || [],
        invoices: invoicesQuery.data || [],
        portalUrl: portalUrlQuery.data,
        isLoading: orgQuery.isLoading || projectsQuery.isLoading,
        error: orgQuery.error || projectsQuery.error
    };
}

export default function BillingPage({ params }: PageProps) {
    const { orgSlug } = use(params);
    const searchParams = useSearchParams();
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);

    useEffect(() => {
        if (searchParams.get('success') === 'true') {
            setShowSuccessMessage(true);
            const timer = setTimeout(() => {
                setShowSuccessMessage(false);
                window.history.replaceState({}, '', window.location.pathname);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [searchParams]);

    const { org, projects, transactions, invoices, portalUrl, isLoading, error } = useBillingData(orgSlug);

    if (isLoading) {
        return (
            <div className="w-full max-w-5xl mx-auto px-6 py-8 space-y-6 animate-pulse text-current/[0.1]">
                <div className="space-y-4">
                    <Skeleton className="h-6 w-32 rounded bg-current/10" />
                    <Skeleton className="h-4 w-48 rounded bg-current/5" />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                    <Skeleton className="h-32 rounded-lg bg-current/5" />
                    <Skeleton className="h-32 rounded-lg bg-current/5" />
                    <Skeleton className="h-32 rounded-lg bg-current/5" />
                </div>
                <div className="grid gap-6 lg:grid-cols-3">
                    <Skeleton className="h-96 lg:col-span-2 rounded-lg bg-current/5" />
                    <Skeleton className="h-96 rounded-lg bg-current/5" />
                </div>
            </div>
        );
    }

    if (error || !org) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/[0.03] text-destructive/60">
                    <CreditCard className="h-8 w-8" />
                </div>
                <h2 className="text-lg font-bold tracking-tight">Billing Offline</h2>
                <p className="text-xs text-current/40 max-w-[240px] text-center font-medium">
                    We were unable to synchronize with our financial backend. Please check your connection.
                </p>
                <Button variant="outline" className="h-8 px-4 text-xs font-bold border-current/20" onClick={() => window.location.reload()}>RETRY SYNC</Button>
            </div>
        );
    }

    // Mapping for project budget format
    const formattedProjects = projects.map(p => ({
        id: p.id,
        name: p.name,
        monthlyBudget: p.monthly_budget,
        spendCap: p.spend_cap,
        enforceSpendCap: p.enforce_spend_cap,
        currentSpend: 0
    }));

    // Mapping for credits format
    const formattedTransactions = transactions.map((t: any) => ({
        id: t.id,
        amount: t.amount,
        type: t.transaction_type,
        description: t.description,
        createdAt: t.created_at
    }));

    return (
        <div className="w-full max-w-5xl mx-auto px-6 py-8 pb-32">
            <div className="mb-8">
                <h1 className="text-base font-medium">Billing</h1>
            </div>
            <AnimatePresence>
                {showSuccessMessage && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="mb-6"
                    >
                        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded border border-emerald-500/20 bg-emerald-500/[0.03] text-emerald-600 dark:text-emerald-400">
                            <div className="text-[10px] font-bold uppercase tracking-wider">
                                Transaction verified — Subscription updated
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="space-y-6">
                <UsageOverview
                    monthlyRequestsUsed={org.monthly_requests_used}
                    monthlyRequestLimit={org.monthly_request_limit}
                    projectCount={projects.length}
                    projectLimit={org.subscription_tier === 'free' ? 1 : 999999}
                    tier={org.subscription_tier}
                />

                <PlanDetails
                    tier={org.subscription_tier}
                    status={org.subscription_status}
                    currentPeriodEnd={org.subscription_current_period_end}
                    price={org.subscription_tier === 'pro' ? 49 : org.subscription_tier === 'team' ? 149 : 0}
                />

                <CreditBalance
                    balance={org.credits_balance || 0}
                    transactions={formattedTransactions}
                />

                <PaymentMethods
                    methods={[]}
                    portalUrl={portalUrl}
                />

                <CostControl projects={formattedProjects} />

                <InvoiceHistory invoices={invoices as any} />

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

                <div className="rounded-md border border-dashed border-border/40 bg-card/50 p-4">
                    <div className="flex items-start gap-3">
                        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Support</h4>
                            <p className="text-[10px] text-muted-foreground leading-relaxed font-medium">
                                For enterprise contracts or custom invoicing, please reach out to our team.
                            </p>
                            <Button variant="link" className="h-auto p-0 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:no-underline transition-colors uppercase tracking-wider">
                                Contact Support →
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
