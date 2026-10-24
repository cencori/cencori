'use client';

import { use } from 'react';
import { BadgeDollarSignIcon } from '@hugeicons/core-free-icons';
import { ProjectPickerLanding } from '@/components/dashboard/ProjectPickerLanding';

interface PageProps {
    params: Promise<{ orgSlug: string }>;
}

export default function OrgRevenuePickerPage({ params }: PageProps) {
    const { orgSlug } = use(params);
    return (
        <ProjectPickerLanding
            orgSlug={orgSlug}
            title="Revenue"
            subtitle="Select a project to manage revenue from AI usage."
            icon={BadgeDollarSignIcon}
            destinationSuffix="revenue"
            emptyStateBody="Revenue lives inside projects. Create a project to meter usage, set pricing, and bill your customers."
        />
    );
}
