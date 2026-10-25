'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReducedMotion } from 'framer-motion';
import { MetricCard, type MetricCardConfig } from '@/components/dashboard/project-overview/ProjectOverviewDashboard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface UsageResponse {
    plan: { tier: string; name: string };
    freeQuestionsPerDay: number | null;
    questionsToday: number;
    days: number;
    billedUsd: number;
    messages: number;
    daily: { date: string; messages: number; billedUsd: number }[];
}

// Usage is kept per question; charts are bucketed by UTC day.
const PERIODS = [
    { value: '7', label: 'Last 7 days' },
    { value: '30', label: 'Last 30 days' },
    { value: '90', label: 'Last 90 days' },
];

function formatUsd(value: number): string {
    if (value > 0 && value < 0.01) return '<$0.01';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

const COST_COLOR = '#8b5cf6';
const MESSAGES_COLOR = '#3b82f6';
const numberFormat = new Intl.NumberFormat('en-US');

/** "2026-10-23" → "Oct 23" (days are UTC). */
function formatChartDay(day: string): string {
    return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}


export function CopilotUsage({ organizationId }: { organizationId: string }) {
    const reduceMotion = useReducedMotion();
    const [days, setDays] = useState('30');

    const { data, isLoading, error } = useQuery({
        queryKey: ['copilotUsage', organizationId, days],
        queryFn: async (): Promise<UsageResponse> => {
            const params = new URLSearchParams({ organizationId, days });
            const response = await fetch(`/api/copilot/usage?${params}`);
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.error || 'We could not load Copilot usage.');
            }
            return response.json();
        },
        staleTime: 15_000,
        // Keep the previous period on screen while the next one loads.
        placeholderData: (previous) => previous,
    });

    const loading = isLoading || !data;
    const periodLabel = PERIODS.find((period) => period.value === days)?.label.toLowerCase() ?? '';
    const chartData = (data?.daily ?? []).map((point) => ({ date: formatChartDay(point.date), cost: point.billedUsd, messages: point.messages }));
    const costConfig: MetricCardConfig = {
        title: 'Cost',
        detail: periodLabel,
        series: [{ key: 'cost', label: 'Billed', color: COST_COLOR, value: formatUsd(data?.billedUsd ?? 0) }],
        formatValue: (value) => formatUsd(value),
        formatAxis: (value) => `$${value.toFixed(value < 1 ? 2 : 0)}`,
    };
    const messagesConfig: MetricCardConfig = {
        title: 'Messages',
        detail: periodLabel,
        series: [{ key: 'messages', label: 'Messages', color: MESSAGES_COLOR, value: numberFormat.format(data?.messages ?? 0) }],
        formatValue: (value) => numberFormat.format(value),
        formatAxis: (value) => numberFormat.format(value),
    };

    if (error) {
        return (
            <p className="py-16 text-center text-xs text-muted-foreground">
                {error instanceof Error ? error.message : 'Could not load Copilot usage.'}
            </p>
        );
    }

    return (
        <div>
            <div className="mb-4 flex justify-end">
                <Select value={days} onValueChange={setDays}>
                    <SelectTrigger aria-label="Select usage period" className="h-7 w-[140px] text-xs shadow-none dark:shadow-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {PERIODS.map((period) => (
                            <SelectItem key={period.value} value={period.value} className="text-xs">{period.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <MetricCard config={costConfig} data={chartData} loading={loading} hasData={(data?.billedUsd ?? 0) > 0} reduceMotion={reduceMotion} />
                <MetricCard config={messagesConfig} data={chartData} loading={loading} hasData={(data?.messages ?? 0) > 0} reduceMotion={reduceMotion} />
            </div>
        </div>
    );
}
