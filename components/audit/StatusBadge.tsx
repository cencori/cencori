'use client';

import { cn } from '@/lib/utils';

interface StatusBadgeProps {
    status: 'success' | 'success_fallback' | 'filtered' | 'blocked_output' | 'error' | 'rate_limited';
    className?: string;
    variant?: 'default' | 'code';
}

const statusConfig = {
    success: {
        label: 'Success',
        code: '200',
        color: 'bg-emerald-500/20 text-emerald-400',
    },
    success_fallback: {
        label: 'Fallback',
        code: '200',
        color: 'bg-amber-500/20 text-amber-400',
    },
    filtered: {
        label: 'Filtered',
        code: '400',
        color: 'bg-orange-500/20 text-orange-400',
    },
    blocked_output: {
        label: 'Blocked',
        code: '400',
        color: 'bg-orange-500/20 text-orange-400',
    },
    error: {
        label: 'Error',
        code: '500',
        color: 'bg-red-500/20 text-red-400',
    },
    rate_limited: {
        label: 'Rate Limited',
        code: '429',
        color: 'bg-yellow-500/20 text-yellow-400',
    },
};

export function StatusBadge({ status, className, variant = 'default' }: StatusBadgeProps) {
    const config = statusConfig[status] || statusConfig.error;

    // Supabase-style code badge
    if (variant === 'code') {
        return (
            <span
                className={cn(
                    'inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-mono font-medium',
                    config.color,
                    className
                )}
            >
                {config.code}
            </span>
        );
    }

    // Default label badge
    return (
        <span
            className={cn(
                'inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium',
                config.color,
                className
            )}
        >
            {config.label}
        </span>
    );
}
