"use client";

import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { cn } from "@/lib/utils";

type Tier = 'free' | 'pro' | 'team' | 'enterprise';

const tiers: Array<{
    name: Tier;
    displayName: string;
    description: string;
    price: { monthly: number | string; annual: number | string };
    limit: string;
    features: string[];
    highlighted?: boolean;
    cta: string;
    ctaVariant?: 'default' | 'outline' | 'ghost';
    icon?: React.ReactNode;
}> = [
        {
            name: 'free',
            displayName: 'Free',
            description: 'Perfect for side projects and experimentation.',
            price: { monthly: 0, annual: 0 },
            limit: '1,000',
            features: [
                '1,000 requests/month',
                '1 project',
                'Basic security features',
                'Community support',
            ],
            cta: 'Start Free',
            ctaVariant: 'outline',
        },
        {
            name: 'pro',
            displayName: 'Pro',
            description: 'For professional developers and small teams.',
            price: { monthly: 49, annual: 490 },
            limit: '50,000',
            features: [
                '50,000 requests/month',
                'Unlimited projects',
                'All security features',
                'Priority support (24hr)',
                'Advanced analytics',
                'Webhooks & integrations',
            ],
            highlighted: true,
            cta: 'Get Started',
        },
        {
            name: 'team',
            displayName: 'Team',
            description: 'For growing teams needing collaboration.',
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
            cta: 'Get Started',
            ctaVariant: 'outline',
        },
        {
            name: 'enterprise',
            displayName: 'Enterprise',
            description: 'For large organizations with custom needs.',
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
            cta: 'Contact Sales',
            ctaVariant: 'outline',
        },
    ];

export function Pricing() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setIsAuthenticated(!!session);
        };
        checkAuth();

        const { data: authListener } = supabase.auth.onAuthStateChange((_event: string, session: { user: { user_metadata?: Record<string, unknown>; email?: string } } | null) => {
            setIsAuthenticated(!!session);
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    const handleCTA = (tier: Tier) => {
        if (tier === 'enterprise') {
            window.location.href = '/contact';
        } else if (isAuthenticated) {
            window.location.href = '/dashboard/organizations';
        } else {
            window.location.href = '/signup';
        }
    };

    return (
        <section className="py-24 bg-background relative overflow-hidden">
            <div className="max-w-6xl mx-auto px-4 md:px-6 relative z-10">
                {/* Header */}
                <div className="text-center mb-12">
                    <Badge variant="outline" className="rounded-full px-4 py-1 mb-4 text-xs font-medium border-border/50">
                        Pricing
                    </Badge>
                    <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                        Simple, transparent pricing
                    </h2>
                    <p className="text-muted-foreground max-w-md mx-auto mb-8">
                        Start free, scale as you grow. No hidden fees, no surprises.
                    </p>

                    {/* Billing Toggle */}
                    <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/50 border border-border/50">
                        <button
                            onClick={() => setBillingPeriod('monthly')}
                            className={cn(
                                "px-4 py-1.5 text-xs font-medium rounded-full transition-all",
                                billingPeriod === 'monthly'
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setBillingPeriod('annual')}
                            className={cn(
                                "px-4 py-1.5 text-xs font-medium rounded-full transition-all flex items-center gap-1.5",
                                billingPeriod === 'annual'
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Annual
                            <span className="text-[10px] text-emerald-500 font-semibold">-17%</span>
                        </button>
                    </div>
                </div>

                {/* Pricing Cards */}
                <div className="grid gap-4 lg:grid-cols-4 md:grid-cols-2">
                    {tiers.map((tier) => (
                        <div
                            key={tier.name}
                            className={cn(
                                "relative flex flex-col p-5 rounded-2xl border transition-all duration-300",
                                tier.highlighted
                                    ? "bg-card border-border shadow-lg"
                                    : "bg-card border-border/50 hover:border-border hover:shadow-lg"
                            )}
                        >
                            {tier.highlighted && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <Badge className="rounded-full px-3 py-0.5 text-[10px] font-medium bg-emerald-500 text-white border-0 shadow-sm">
                                        Most Popular
                                    </Badge>
                                </div>
                            )}

                            {/* Tier Name */}
                            <div className="flex items-center gap-2 mb-2">
                                {tier.icon && (
                                    <span className="text-emerald-500">
                                        {tier.icon}
                                    </span>
                                )}
                                <h3 className="text-sm font-semibold">{tier.displayName}</h3>
                            </div>

                            {/* Description */}
                            <p className="text-xs text-muted-foreground mb-4 h-8">
                                {tier.description}
                            </p>

                            {/* Price */}
                            <div className="flex items-baseline gap-1 mb-5 pb-5 border-b border-border/50">
                                {typeof tier.price.monthly === 'number' ? (
                                    <>
                                        <span className="text-3xl font-bold tracking-tight">
                                            ${billingPeriod === 'annual'
                                                ? Math.round(Number(tier.price.annual) / 12)
                                                : tier.price.monthly
                                            }
                                        </span>
                                        <span className="text-sm text-muted-foreground">/mo</span>
                                        {billingPeriod === 'annual' && tier.price.monthly > 0 && (
                                            <span className="text-[10px] text-muted-foreground ml-1">billed annually</span>
                                        )}
                                    </>
                                ) : (
                                    <span className="text-3xl font-bold tracking-tight">{tier.price.monthly}</span>
                                )}
                            </div>

                            {/* Features */}
                            <div className="flex-1 mb-5">
                                <ul className="space-y-2">
                                    {tier.features.map((feature, i) => (
                                        <li key={i} className="flex items-start gap-2 text-xs">
                                            <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" />
                                            <span className="text-muted-foreground">
                                                {feature}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* CTA Button */}
                            <Button
                                className="w-full rounded-full h-9 text-xs font-medium cursor-pointer transition-all duration-300 group"
                                variant={tier.ctaVariant || 'default'}
                                onClick={() => handleCTA(tier.name)}
                            >
                                {tier.cta}
                                <ArrowRight className="w-3 h-3 ml-1 transition-transform group-hover:translate-x-0.5" />
                            </Button>
                        </div>
                    ))}
                </div>

                {/* Bottom Note */}
                <div className="text-center mt-12">
                    <p className="text-xs text-muted-foreground">
                        All plans include SSL encryption, 99.9% uptime SLA, and GDPR compliance.{' '}
                        <a href="/contact" className="text-foreground font-medium hover:underline underline-offset-2">
                            Contact sales
                        </a>{' '}
                        for volume discounts.
                    </p>
                </div>
            </div>
        </section>
    );
}
