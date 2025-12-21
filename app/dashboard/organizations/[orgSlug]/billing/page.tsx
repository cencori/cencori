"use client";

import React, { useEffect, useState } from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from '@/lib/supabaseClient';
import { useParams, useSearchParams } from 'next/navigation';
import { Check, AlertTriangle, CheckCircle, CreditCard } from 'lucide-react';

interface Organization {
    id: string;
    name: string;
    subscription_tier: 'free' | 'pro' | 'team' | 'enterprise';
    subscription_status: string;
    monthly_requests_used: number;
    monthly_request_limit: number;
    subscription_current_period_end: string | null;
}

type Tier = 'free' | 'pro' | 'team' | 'enterprise';

export default function BillingPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const orgSlug = params.orgSlug as string;
    const [org, setOrg] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);

    useEffect(() => {
        if (searchParams.get('success') === 'true') {
            setShowSuccessMessage(true);
            setTimeout(() => {
                window.history.replaceState({}, '', window.location.pathname);
            }, 100);
        }
    }, [searchParams]);

    useEffect(() => {
        async function fetchOrg() {
            const { data, error } = await supabase
                .from('organizations')
                .select('id, name, subscription_tier, subscription_status, monthly_requests_used, monthly_request_limit, subscription_current_period_end')
                .eq('slug', orgSlug)
                .single();

            if (!error && data) {
                setOrg(data);
            }
            setLoading(false);
        }
        fetchOrg();
    }, [orgSlug]);

    const handleUpgrade = async (tier: 'pro' | 'team', cycle: 'monthly' | 'annual') => {
        if (!org) return;

        try {
            const response = await fetch('/api/billing/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tier, cycle, orgId: org.id }),
            });

            const data = await response.json();

            if (!response.ok || !data.checkoutUrl) {
                alert(`Failed to start checkout: ${data.error || 'Unknown error'}`);
                return;
            }

            window.location.href = data.checkoutUrl;
        } catch (error) {
            alert('Failed to start checkout. Please try again.');
        }
    };

    if (loading) {
        return (
            <div className="w-full max-w-5xl mx-auto px-6 py-8">
                <Skeleton className="h-5 w-24 mb-6" />
                <Skeleton className="h-24 mb-6" />
                <div className="grid gap-4 lg:grid-cols-4 md:grid-cols-2">
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-72" />)}
                </div>
            </div>
        );
    }

    if (!org) {
        return (
            <div className="w-full max-w-5xl mx-auto px-6 py-8">
                <div className="text-center py-16 flex flex-col items-center">
                    <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center mb-3">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">Organization not found</p>
                </div>
            </div>
        );
    }

    const percentage = Math.min((org.monthly_requests_used / org.monthly_request_limit) * 100, 100);
    const isNearLimit = percentage >= 80;
    const isAtLimit = percentage >= 100;

    const tiers: Array<{
        name: Tier;
        displayName: string;
        price: { monthly: number | string; annual: number | string };
        limit: string;
        features: string[];
        highlighted?: boolean;
    }> = [
            {
                name: 'free',
                displayName: 'Free',
                price: { monthly: 0, annual: 0 },
                limit: '1,000',
                features: ['1,000 requests/month', '1 project', 'Basic security', 'Community support'],
            },
            {
                name: 'pro',
                displayName: 'Pro',
                price: { monthly: 49, annual: 490 },
                limit: '50,000',
                features: ['50,000 requests/month', 'Unlimited projects', 'All security features', 'Priority support', 'Analytics', 'Webhooks'],
                highlighted: true,
            },
            {
                name: 'team',
                displayName: 'Team',
                price: { monthly: 149, annual: 1490 },
                limit: '250,000',
                features: ['250,000 requests/month', 'Everything in Pro', '10 team members', '4hr support', 'API access', '90-day logs'],
            },
            {
                name: 'enterprise',
                displayName: 'Enterprise',
                price: { monthly: 'Custom', annual: 'Custom' },
                limit: 'Unlimited',
                features: ['Unlimited requests', 'Everything in Team', 'Unlimited members', 'Dedicated support', 'SLA', 'Custom integrations'],
            },
        ];

    return (
        <div className="w-full max-w-5xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-base font-medium">Billing</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Manage your subscription and monitor usage</p>
            </div>

            {/* Success Message */}
            {showSuccessMessage && (
                <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        <span className="font-medium">Subscription updated!</span> Your new plan is now active.
                    </p>
                </div>
            )}

            {/* Usage Overview */}
            <div className="rounded-md border border-border/40 bg-card p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h3 className="text-xs font-medium">Current Usage</h3>
                        <p className="text-[10px] text-muted-foreground">
                            {org.monthly_requests_used.toLocaleString()} / {org.monthly_request_limit.toLocaleString()} requests
                        </p>
                    </div>
                    <Badge variant={isAtLimit ? 'destructive' : 'outline'} className="text-[10px] h-5 uppercase">
                        {org.subscription_tier}
                    </Badge>
                </div>
                <Progress value={percentage} className="h-2 mb-2" />
                <div className="text-[10px] text-muted-foreground">
                    {isAtLimit ? (
                        <span className="flex items-center gap-1 text-red-500">
                            <AlertTriangle className="h-3 w-3" />
                            Limit reached. Upgrade to continue.
                        </span>
                    ) : isNearLimit ? (
                        <span className="text-amber-500">{Math.round(100 - percentage)}% remaining</span>
                    ) : (
                        <span>{Math.round(percentage)}% used • Resets monthly</span>
                    )}
                </div>
            </div>

            {/* Subscription Details */}
            {org.subscription_tier !== 'free' && org.subscription_current_period_end && (
                <div className="rounded-md border border-border/40 bg-card p-4 mb-6">
                    <h3 className="text-xs font-medium mb-2">Subscription</h3>
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Status</span>
                            <Badge variant={org.subscription_status === 'active' ? 'outline' : 'secondary'} className="text-[10px] h-5 gap-1">
                                <span className={`size-1.5 rounded-full ${org.subscription_status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                                {org.subscription_status}
                            </Badge>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Renews</span>
                            <span>{new Date(org.subscription_current_period_end).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Pricing Tiers */}
            <div>
                <h2 className="text-sm font-medium mb-4">Available Plans</h2>
                <div className="grid gap-4 lg:grid-cols-4 md:grid-cols-2">
                    {tiers.map((tier) => {
                        const isCurrent = org.subscription_tier === tier.name;
                        const canUpgrade = !isCurrent && org.subscription_tier !== 'enterprise';

                        return (
                            <div
                                key={tier.name}
                                className={`rounded-md border bg-card p-4 relative ${isCurrent ? 'border-primary bg-primary/5' : 'border-border/40'
                                    } ${tier.highlighted && !isCurrent ? 'border-primary/50' : ''}`}
                            >
                                {isCurrent && (
                                    <Badge className="absolute -top-2 left-3 text-[9px] h-4 px-1.5">Current</Badge>
                                )}
                                {tier.highlighted && !isCurrent && (
                                    <Badge variant="secondary" className="absolute -top-2 left-3 text-[9px] h-4 px-1.5">Popular</Badge>
                                )}

                                <div className="mb-3 pt-1">
                                    <h3 className="text-sm font-medium">{tier.displayName}</h3>
                                    <p className="text-[10px] text-muted-foreground">{tier.limit} requests/month</p>
                                </div>

                                <div className="mb-4">
                                    {typeof tier.price.monthly === 'number' ? (
                                        <>
                                            <span className="text-2xl font-semibold font-mono">${tier.price.monthly}</span>
                                            <span className="text-xs text-muted-foreground">/mo</span>
                                        </>
                                    ) : (
                                        <span className="text-lg font-semibold">{tier.price.monthly}</span>
                                    )}
                                </div>

                                <div className="space-y-1.5 mb-4">
                                    {tier.features.map((feature, i) => (
                                        <div key={i} className="flex items-start gap-1.5 text-[11px]">
                                            <Check className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                                            <span>{feature}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-2">
                                    {isCurrent ? (
                                        <Button className="w-full h-7 text-xs" disabled>Current Plan</Button>
                                    ) : tier.name === 'enterprise' ? (
                                        <Button className="w-full h-7 text-xs" variant="outline" onClick={() => window.location.href = '/contact'}>
                                            Contact Sales
                                        </Button>
                                    ) : canUpgrade && tier.name !== 'free' ? (
                                        <>
                                            <Button className="w-full h-7 text-xs" onClick={() => handleUpgrade(tier.name as 'pro' | 'team', 'monthly')}>
                                                ${tier.price.monthly}/mo
                                            </Button>
                                            <Button className="w-full h-7 text-xs" variant="outline" onClick={() => handleUpgrade(tier.name as 'pro' | 'team', 'annual')}>
                                                ${tier.price.annual}/yr
                                                <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 px-1">-17%</Badge>
                                            </Button>
                                        </>
                                    ) : (
                                        <Button className="w-full h-7 text-xs" variant="outline" disabled>
                                            {tier.name === 'free' ? 'Free Forever' : 'N/A'}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
