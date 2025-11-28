"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TechnicalBorder } from "./TechnicalBorder";
import { Check } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

type Tier = 'free' | 'pro' | 'team' | 'enterprise';

const tiers: Array<{
    name: Tier;
    displayName: string;
    price: { monthly: number | string; annual: number | string };
    limit: string;
    features: string[];
    highlighted?: boolean;
    cta: string;
    ctaVariant?: 'default' | 'outline';
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
        cta: 'Get Started',
        ctaVariant: 'outline',
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
        cta: 'Get Started',
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
        cta: 'Get Started',
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
        cta: 'Contact Sales',
        ctaVariant: 'outline',
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

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
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
        <section className="py-20 px-4">
            <div className="container mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold mb-4">Simple, Transparent Pricing</h2>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Start free, scale as you grow. No hidden fees.
                    </p>
                </div>

                {/* Pricing Cards */}
                <div className="grid gap-8 lg:grid-cols-4 md:grid-cols-2 max-w-7xl mx-auto">
                    {tiers.map((tier) => (
                        <TechnicalBorder
                            key={tier.name}
                            cornerSize={16}
                            borderWidth={2}
                            active={tier.highlighted}
                            hoverEffect={true}
                        >
                            <Card className={`relative border-0 shadow-none h-full ${
                                tier.highlighted ? 'bg-primary/5' : ''
                            }`}>
                                {tier.highlighted && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                        <Badge className="rounded-none">Most Popular</Badge>
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
                                
                                <CardContent className="space-y-6">
                                    <div className="space-y-3">
                                        {tier.features.map((feature, i) => (
                                            <div key={i} className="flex items-start gap-2 text-sm">
                                                <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                                <span>{feature}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <Button
                                        className="w-full rounded-none"
                                        variant={tier.ctaVariant || 'default'}
                                        onClick={() => handleCTA(tier.name)}
                                    >
                                        {tier.cta}
                                    </Button>

                                    {typeof tier.price.annual === 'number' && tier.price.annual > 0 && (
                                        <p className="text-xs text-center text-muted-foreground">
                                            or ${tier.price.annual}/year (save 17%)
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        </TechnicalBorder>
                    ))}
                </div>

                {/* FAQ Link */}
               <div className="text-center mt-12">
                    <p className="text-muted-foreground">
                        Need help choosing? <a href="/contact" className="text-primary hover:underline">Contact our team</a>
                    </p>
                </div>
            </div>
        </section>
    );
}
