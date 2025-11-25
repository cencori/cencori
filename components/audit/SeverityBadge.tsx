import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, AlertOctagon, Info, Shield } from 'lucide-react';

interface SeverityBadgeProps {
    severity: 'critical' | 'high' | 'medium' | 'low';
    className?: string;
    showIcon?: boolean;
}

const severityConfig = {
    critical: {
        label: 'Critical',
        color: 'bg-red-500/10 text-red-600 dark:text-red-500 border-red-500/20',
        icon: AlertOctagon,
    },
    high: {
        label: 'High',
        color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-500/20',
        icon: AlertTriangle,
    },
    medium: {
        label: 'Medium',
        color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-500/20',
        icon: AlertTriangle,
    },
    low: {
        label: 'Low',
        color: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
        icon: Info,
    },
};

export function SeverityBadge({ severity, className, showIcon = true }: SeverityBadgeProps) {
    const config = severityConfig[severity] || severityConfig.low;
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
