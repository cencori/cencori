"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import { CreditsWidget } from '@/components/dashboard/CreditsWidget';
import { ProvidersOverview } from '@/components/dashboard/ProvidersOverview';

export default function OrganizationDashboard() {
    const params = useParams();
    const orgSlug = params.orgSlug as string;

    return (
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="pb-8">
                <h1 className="text-3xl font-bold">Organization Overview</h1>
                <p className="text-muted-foreground mt-2">
                    Multi-model AI platform status and credits
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <CreditsWidget orgSlug={orgSlug} />
                <ProvidersOverview orgSlug={orgSlug} />
            </div>
        </div>
    );
}
