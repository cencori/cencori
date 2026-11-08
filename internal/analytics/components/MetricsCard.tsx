'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MetricsCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    subtitleColor?: 'default' | 'success' | 'warning' | 'error';
    icon?: ReactNode;
    className?: string;
    children?: ReactNode;
}

export function MetricsCard({
    title,
    value,
    subtitle,
    subtitleColor = 'default',
    icon,
    className,
    children,
}: MetricsCardProps) {
    const subtitleColorClass = {
        default: 'text-muted-foreground',
        success: 'text-emerald-500',
        warning: 'text-amber-500',
        error: 'text-red-500',
    }[subtitleColor];

    return (
        <div className={cn('rounded-xl border border-border/50 bg-card p-5', className)}>
            <div className="flex items-start justify-between mb-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {title}
                </p>
                {icon && (
                    <div className="text-muted-foreground">
                        {icon}
                    </div>
                )}
            </div>
            <p className="text-2xl font-semibold font-mono">
                {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {subtitle && (
                <p className={cn('text-[10px] mt-1', subtitleColorClass)}>
                    {subtitle}
                </p>
            )}
            {children}
        </div>
    );
}

interface MetricsGridProps {
    children: ReactNode;
    columns?: 2 | 3 | 4;
    className?: string;
}

export function MetricsGrid({ children, columns = 3, className }: MetricsGridProps) {
    const gridCols = {
        2: 'grid-cols-1 md:grid-cols-2',
        3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    }[columns];

    return (
        <div className={cn('grid gap-4', gridCols, className)}>
            {children}
        </div>
    );
}

interface MetricsSectionProps {
    title: string;
    description?: string;
    children: ReactNode;
    className?: string;
}

export function MetricsSection({ title, description, children, className }: MetricsSectionProps) {
    return (
        <section className={cn('space-y-4', className)}>
            <div>
                <h2 className="text-sm font-semibold">{title}</h2>
                {description && (
                    <p className="text-xs text-muted-foreground">{description}</p>
                )}
            </div>
            {children}
        </section>
    );
}
