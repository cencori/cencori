"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TechnicalBorder } from "@/components/landing/TechnicalBorder";
import { supabase } from '@/lib/supabaseClient';
import { useParams, useSearchParams } from 'next/navigation';
import { Check, AlertTriangle, CheckCircle } from 'lucide-react';

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
        // Check if returning from successful checkout
        if (searchParams.get('success') === 'true') {
            setShowSuccessMessage(true);
            // Clear the success param from URL after a moment
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

            if (!response.ok) {
                console.error('Checkout API error:', data);
                alert(`Failed to start checkout: ${data.error || 'Unknown error'}`);
                return;
            }

            if (!data.checkoutUrl) {
                console.error('No checkout URL returned:', data);
                alert('Failed to get checkout URL. Please try again.');
                return;
            }

            console.log('Redirecting to checkout:', data.checkoutUrl);
            window.location.href = data.checkoutUrl;
        } catch (error) {
            console.error('Checkout error:', error);
            alert('Failed to start checkout. Please check your internet connection and try again.');
        }
    };

    if (loading) {
        return (
            <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <Skeleton className="h-8 w-48 mb-6" />
                <div className="grid gap-6 lg:grid-cols-4">
                    <Skeleton className="h-96" />
                    <Skeleton className="h-96" />
                    <Skeleton className="h-96" />
                    <Skeleton className="h-96" />
                </div>
            </div>
        );
    }

    if (!org) {
        return <div>Organization not found</div>;
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
                features: [
                    '1,000 requests/month',
                    '1 project',
                    'Basic security features',
                    'Community support',
                ],
            },
            {
                name: 'pro',
                displayName: 'Pro',
                price: { monthly: 49, annual: 490 },
                limit: '50,000',
                features: [
                    '50,000 requests/month',
                    'Unlimited projects',
                    'All security features',
                    'Priority support (24hr)',
                    'Advanced analytics',
                    'Webhooks',
                ],
                highlighted: true,
            },
            {
                name: 'team',
                displayName: 'Team',
                price: { monthly: 149, annual: 1490 },
                limit: '250,000',
                features: [
                    '250,000 requests/month',
                    'Everything in Pro',
                    'Team collaboration (10 members)',
                    'Priority support (4hr)',
                    'API access',
                    '90-day log retention',
                ],
            },
            {
                name: 'enterprise',
                displayName: 'Enterprise',
                price: { monthly: 'Custom', annual: 'Custom' },
                limit: 'Unlimited',
                features: [
                    'Unlimited requests',
                    'Everything in Team',
                    'Unlimited members',
                    'Dedicated support',
                    'SLA guarantees',
                    'Custom integrations',
                ],
            },
        ];

    return (
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Header */}
            <div className="pb-8">
                <h1 className="text-3xl font-bold">Billing</h1>
                <p className="text-muted-foreground mt-2">
                    Manage your subscription and monitor usage
                </p>
            </div>

            {/* Success Message */}
            {showSuccessMessage && (
                <Alert className="mb-6 border-green-500/50 bg-green-500/10">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <AlertDescription className="text-green-700 dark:text-green-300">
                        <strong className="font-semibold">Subscription updated successfully!</strong> Your new plan is now active. It may take a few moments for changes to reflect.
                    </AlertDescription>
                </Alert>
            )}

            {/* Usage Overview */}
            <Card className="mb-8 rounded-none border-2">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Current Usage</CardTitle>
                        <Badge variant={isAtLimit ? 'destructive' : isNearLimit ? 'secondary' : 'default'}>
                            {org.subscription_tier.toUpperCase()}
                        </Badge>
                    </div>
                    <CardDescription>
                        {org.monthly_requests_used.toLocaleString()} / {org.monthly_request_limit.toLocaleString()} requests this month
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Progress value={percentage} className="h-3" />
                    <div className="text-sm text-muted-foreground">
                        {isAtLimit ? (
                            <Alert>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>
                                    You&apos;ve reached your monthly limit. Upgrade to continue making requests.
                                </AlertDescription>
                            </Alert>
                        ) : isNearLimit ? (
                            <Alert>
                                <AlertDescription>
                                    You&apos;re approaching your monthly limit ({Math.round(100 - percentage)}% remaining).
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <p>{Math.round(percentage)}% used • Resets on the 1st of each month</p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Subscription Details (if applicable) */}
            {org.subscription_tier !== 'free' && org.subscription_current_period_end && (
                <Card className="mb-8 rounded-none border-2">
                    <CardHeader>
                        <CardTitle>Subscription Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Status</span>
                            <Badge variant={org.subscription_status === 'active' ? 'default' : 'secondary'}>
                                {org.subscription_status}
                            </Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Renews on</span>
                            <span>{new Date(org.subscription_current_period_end).toLocaleDateString()}</span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Pricing Tiers */}
            <div>
                <h2 className="text-2xl font-bold mb-6">Available Plans</h2>
                <div className="grid gap-6 lg:grid-cols-4 md:grid-cols-2">
                    {tiers.map((tier) => {
                        const isCurrent = org.subscription_tier === tier.name;
                        const canUpgrade = !isCurrent && org.subscription_tier !== 'enterprise';

                        return (
                            <TechnicalBorder
                                key={tier.name}
                                cornerSize={16}
                                borderWidth={2}
                                active={isCurrent}
                                hoverEffect={!isCurrent}
                                className={`${isCurrent ? 'bg-primary/5' : ''}`}
                            >
                                <Card className={`relative border-0 shadow-none ${tier.highlighted && !isCurrent ? 'bg-background' : ''
                                    } ${isCurrent ? 'bg-primary/5' : ''}`}>
                                    {isCurrent && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                            <Badge className="rounded-none">Current Plan</Badge>
                                        </div>
                                    )}
                                    {tier.highlighted && !isCurrent && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                            <Badge variant="default" className="rounded-none">Most Popular</Badge>
                                        </div>
                                    )}

                                    <CardHeader>
                                        <CardTitle className="text-2xl">{tier.displayName}</CardTitle>
                                        <CardDescription>{tier.limit} requests/month</CardDescription>
                                        <div className="pt-4">
                                            {typeof tier.price.monthly === 'number' ? (
                                                <>
                                                    <span className="text-4xl font-bold">${tier.price.monthly}</span>
                                                    <span className="text-muted-foreground">/month</span>
                                                </>
                                            ) : (
                                                <span className="text-4xl font-bold">{tier.price.monthly}</span>
                                            )}
                                        </div>
                                    </CardHeader>

                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            {tier.features.map((feature, i) => (
                                                <div key={i} className="flex items-start gap-2 text-sm">
                                                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                                    <span>{feature}</span>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="pt-4 space-y-2">
                                            {isCurrent ? (
                                                <Button className="w-full rounded-none" disabled>
                                                    Current Plan
                                                </Button>
                                            ) : tier.name === 'enterprise' ? (
                                                <Button
                                                    className="w-full rounded-none"
                                                    variant="outline"
                                                    onClick={() => window.location.href = '/contact'}
                                                >
                                                    Contact Sales
                                                </Button>
                                            ) : canUpgrade && tier.name !== 'free' ? (
                                                <>
                                                    <Button
                                                        className="w-full rounded-none"
                                                        onClick={() => handleUpgrade(tier.name as 'pro' | 'team', 'monthly')}
                                                    >
                                                        Upgrade - ${tier.price.monthly}/mo
                                                    </Button>
                                                    <Button
                                                        className="w-full rounded-none"
                                                        variant="outline"
                                                        onClick={() => handleUpgrade(tier.name as 'pro' | 'team', 'annual')}
                                                    >
                                                        ${tier.price.annual}/year
                                                        <Badge className="ml-2 rounded-none" variant="secondary">Save 17%</Badge>
                                                    </Button>
                                                </>
                                            ) : (
                                                <Button className="w-full rounded-none" variant="outline" disabled>
                                                    {tier.name === 'free' ? 'Free Forever' : 'Not Available'}
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </TechnicalBorder>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
