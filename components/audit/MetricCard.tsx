'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
    title: string;
    value: string | number;
    change?: number;
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
        if (trend === 'up') return 'text-emerald-500';
        if (trend === 'down') return 'text-red-500';
        return 'text-muted-foreground';
    };

    const getTrendIcon = () => {
        if (!trend || !change) return null;
        if (trend === 'up') return <TrendingUp className="h-3 w-3" />;
        if (trend === 'down') return <TrendingDown className="h-3 w-3" />;
        return <Minus className="h-3 w-3" />;
    };

    return (
        <div className="rounded-md border border-border/40 bg-card p-4">
            <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{title}</p>
                {icon && <div className="text-muted-foreground">{icon}</div>}
            </div>
            <div className="flex items-baseline justify-between">
                <p className="text-xl font-semibold font-mono">{formatValue(value)}</p>
                {change !== undefined && (
                    <div className={cn('flex items-center gap-1 text-xs font-medium', getTrendColor())}>
                        {getTrendIcon()}
                        <span>{Math.abs(change)}%</span>
                    </div>
                )}
            </div>
        </div>
    );
}
