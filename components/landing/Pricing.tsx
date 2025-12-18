"use client";

import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles } from 'lucide-react';
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
}> = [
        {
            name: 'free',
            displayName: 'Free',
            description: 'For side projects.',
            price: { monthly: 0, annual: 0 },
            limit: '1,000',
            features: [
                '1,000 requests/month',
                '1 project',
                'Basic security features',
                'Community support',
            ],
            cta: 'Get Started',
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
                'Webhooks',
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
            ctaVariant: 'ghost',
        },
    ];

export function Pricing() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

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
            // Authenticated users: go to dashboard to pick org
            window.location.href = '/dashboard/organizations';
        } else {
            // Unauthenticated users: go to signup
            window.location.href = '/signup';
        }
    };

    return (
        <section className="py-24 px-4 relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-foreground/5 blur-[100px] rounded-full pointer-events-none" />

            <div className="container mx-auto relative z-10">
                {/* Header */}
                <div className="text-center mb-20">
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
                        Simple, Transparent Pricing
                    </h2>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Start free, scale as you grow. No hidden fees.
                    </p>
                </div>

                {/* Pricing Cards */}
                <div className="grid gap-6 lg:grid-cols-4 md:grid-cols-2 max-w-7xl mx-auto">
                    {tiers.map((tier) => (
                        <div
                            key={tier.name}
                            className={cn(
                                "relative flex flex-col p-6 rounded-3xl border transition-all duration-300",
                                tier.highlighted
                                    ? "bg-background/80 border-foreground/20 shadow-2xl shadow-foreground/5 scale-105 z-10"
                                    : "bg-background/40 border-border/50 hover:border-foreground/10 hover:bg-background/60"
                            )}
                        >
                            {tier.highlighted && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                    <Badge className="rounded-full px-4 py-1 bg-foreground text-background hover:bg-foreground/90 border-0 shadow-lg shadow-foreground/20">
                                        Most Popular
                                    </Badge>
                                </div>
                            )}

                            <div className="mb-8">
                                <h3 className="text-lg font-semibold mb-2">{tier.displayName}</h3>
                                <p className="text-sm text-muted-foreground mb-6 h-10">{tier.description}</p>
                                <div className="flex items-baseline gap-1">
                                    {typeof tier.price.monthly === 'number' ? (
                                        <>
                                            <span className="text-4xl font-bold tracking-tight">${tier.price.monthly}</span>
                                            <span className="text-muted-foreground">/mo</span>
                                        </>
                                    ) : (
                                        <span className="text-4xl font-bold tracking-tight">{tier.price.monthly}</span>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 mb-8">
                                <ul className="space-y-3">
                                    {tier.features.map((feature, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                                            <Check className="h-4 w-4 text-foreground mt-0.5 shrink-0" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <Button
                                className={cn(
                                    "w-full rounded-full h-12 font-medium cursor-pointer transition-all duration-300",
                                    tier.highlighted
                                        ? "bg-foreground text-background cursor-pointer hover:bg-foreground/90 shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] dark:shadow-[0_0_20px_-5px_rgba(255,255,255,0.1)]"
                                        : ""
                                )}
                                variant={tier.ctaVariant || 'default'}
                                onClick={() => handleCTA(tier.name)}
                            >
                                {tier.cta}
                            </Button>
                        </div>
                    ))}
                </div>

                {/* FAQ Link */}
                <div className="text-center mt-16">
                    <p className="text-muted-foreground">
                        Need help choosing? <a href="/contact" className="text-foreground font-medium hover:underline underline-offset-4">Contact our team</a>
                    </p>
                </div>
            </div>
        </section>
    );
}
