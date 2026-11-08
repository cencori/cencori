'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

interface BudgetAlertBannerProps {
    projectId: string;
    settingsHref: string;
}

interface BudgetStatus {
    monthly_budget: number | null;
    spend_cap: number | null;
    enforce_spend_cap: boolean;
    current_spend: number;
    percent_used: number | null;
    is_cap_reached: boolean;
}

export function BudgetAlertBanner({ projectId, settingsHref }: BudgetAlertBannerProps) {
    const [dismissed, setDismissed] = useState(false);

    const { data: budget } = useQuery<BudgetStatus>({
        queryKey: ['budgetStatus', projectId],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/budget`);
            if (!res.ok) return null;
            return res.json();
        },
        staleTime: 60 * 1000,
        refetchInterval: 5 * 60 * 1000,
    });

    if (dismissed || !budget) return null;

    // Show banner when cap is reached or budget >= 80%
    const isCapReached = budget.is_cap_reached;
    const isHighUsage = budget.percent_used !== null && budget.percent_used >= 80 && !isCapReached;

    if (!isCapReached && !isHighUsage) return null;

    return (
        <div className={`flex items-center gap-3 px-4 py-2 text-xs ${
            isCapReached
                ? 'bg-destructive/10 text-destructive border-b border-destructive/20'
                : 'bg-amber-500/10 text-amber-500 border-b border-amber-500/20'
        }`}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">
                {isCapReached ? (
                    <>
                        <strong>Spend cap reached.</strong> API requests are blocked. Current spend: ${budget.current_spend.toFixed(2)} / ${budget.spend_cap?.toFixed(2)} cap.
                    </>
                ) : (
                    <>
                        <strong>Budget warning:</strong> {Math.round(budget.percent_used!)}% of monthly budget used (${budget.current_spend.toFixed(2)} / ${budget.monthly_budget?.toFixed(2)}).
                    </>
                )}
            </span>
            <Link
                href={settingsHref}
                className="shrink-0 underline underline-offset-2 hover:opacity-80"
            >
                {isCapReached ? 'Increase cap' : 'View budget'}
            </Link>
            <button
                onClick={() => setDismissed(true)}
                className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
            >
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}
