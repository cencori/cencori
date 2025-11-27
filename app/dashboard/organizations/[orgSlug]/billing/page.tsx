"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { UsageCard, UpgradeCard } from '@/components/billing/BillingComponents';
import { supabase } from '@/lib/supabaseClient';
import { useParams } from 'next/navigation';

interface Organization {
    id: string;
    name: string;
    subscription_tier: 'free' | 'pro' | 'team' | 'enterprise';
    subscription_status: string;
    monthly_requests_used: number;
    monthly_request_limit: number;
    subscription_current_period_end: string | null;
}

export default function BillingPage() {
    const params = useParams();
    const orgSlug = params.orgSlug as string;
    const [org, setOrg] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);

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

    if (loading) {
        return (
            <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <Skeleton className="h-8 w-48 mb-6" />
                <div className="grid gap-6 md:grid-cols-2">
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        );
    }

    if (!org) {
        return <div>Organization not found</div>;
    }

    return (
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between pb-6">
                <div>
                    <h1 className="text-2xl font-bold">Billing & Usage</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage your subscription and monitor usage
                    </p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 mb-6">
                <UsageCard
                    used={org.monthly_requests_used}
                    limit={org.monthly_request_limit}
                    tier={org.subscription_tier}
                    orgSlug={orgSlug}
                />

                {org.subscription_tier !== 'enterprise' && (
                    <UpgradeCard
                        currentTier={org.subscription_tier as 'free' | 'pro' | 'team'}
                        nextTier={org.subscription_tier === 'free' ? 'pro' : org.subscription_tier === 'pro' ? 'team' : 'enterprise'}
                        orgId={org.id}
                    />
                )}
            </div>

            {org.subscription_tier !== 'free' && org.subscription_current_period_end && (
                <Card>
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
        </div>
    );
}
