'use client';

import { TechnicalBorder } from '@/components/landing/TechnicalBorder';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
    title: string;
    value: string | number;
    change?: number; // Percentage change
    trend?: 'up' | 'down' | 'neutral';
    icon?: React.ReactNode;
    format?: 'number' | 'currency' | 'percentage' | 'ms';
}

export function MetricCard({ title, value, change, trend, icon, format = 'number' }: MetricCardProps) {
    const formatValue = (val: string | number) => {
        if (typeof val === 'string') return val;

        switch (format) {
            case 'currency':
                return `$${val.toFixed(6)}`;
            case 'percentage':
                return `${val}%`;
            case 'ms':
                return `${val}ms`;
            default:
                return val.toLocaleString();
        }
    };

    const getTrendColor = () => {
        if (!trend) return '';
        if (trend === 'up') return 'text-green-600 dark:text-green-500';
        if (trend === 'down') return 'text-red-600 dark:text-red-500';
        return 'text-zinc-600 dark:text-zinc-400';
    };

    const getTrendIcon = () => {
        if (!trend || !change) return null;
        if (trend === 'up') return <TrendingUp className="h-4 w-4" />;
        if (trend === 'down') return <TrendingDown className="h-4 w-4" />;
        return <Minus className="h-4 w-4" />;
    };

    return (
        <TechnicalBorder className="h-full">
            <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">{title}</p>
                    {icon && <div className="text-muted-foreground">{icon}</div>}
                </div>
                <div className="flex items-baseline justify-between">
                    <p className="text-3xl font-bold">{formatValue(value)}</p>
                    {change !== undefined && (
                        <div className={cn('flex items-center gap-1 text-sm font-medium', getTrendColor())}>
                            {getTrendIcon()}
                            <span>{Math.abs(change)}%</span>
                        </div>
                    )}
                </div>
            </div>
        </TechnicalBorder>
    );
}
