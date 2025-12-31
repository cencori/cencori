import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, ShieldAlert, AlertCircle, Clock, RefreshCw } from 'lucide-react';

interface StatusBadgeProps {
    status: 'success' | 'success_fallback' | 'filtered' | 'blocked_output' | 'error' | 'rate_limited';
    className?: string;
    showIcon?: boolean;
}

const statusConfig = {
    success: {
        label: 'Success',
        color: 'bg-green-500/10 text-green-600 dark:text-green-500 border-green-500/20',
        icon: CheckCircle2,
    },
    success_fallback: {
        label: 'Fallback',
        color: 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20',
        icon: RefreshCw,
    },
    filtered: {
        label: 'Filtered',
        color: 'bg-red-500/10 text-red-600 dark:text-red-500 border-red-500/20',
        icon: ShieldAlert,
    },
    blocked_output: {
        label: 'Blocked Output',
        color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-500/20',
        icon: AlertCircle,
    },
    error: {
        label: 'Error',
        color: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
        icon: XCircle,
    },
    rate_limited: {
        label: 'Rate Limited',
        color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-500/20',
        icon: Clock,
    },
};

export function StatusBadge({ status, className, showIcon = true }: StatusBadgeProps) {
    const config = statusConfig[status] || statusConfig.error;
    const Icon = config.icon;

    return (
        <Badge
            variant="outline"
            className={cn(
                'font-medium',
                config.color,
                className
            )}
        >
            {showIcon && <Icon className="mr-1 h-3 w-3" />}
            {config.label}
        </Badge>
    );
}
