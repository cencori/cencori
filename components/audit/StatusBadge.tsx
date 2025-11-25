import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    CheckCircle2,
    XCircle,
    AlertCircle,
    ShieldAlert,
    Clock
} from "lucide-react";

type StatusType = 'success' | 'filtered' | 'blocked_output' | 'error' | 'rate_limited';

interface StatusBadgeProps {
    status: StatusType;
    className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
    const config = {
        success: {
            label: "Success",
            icon: CheckCircle2,
            variant: "outline" as const,
            className: "border-green-500/20 text-green-600 bg-green-500/5 hover:bg-green-500/10",
        },
        filtered: {
            label: "Filtered",
            icon: ShieldAlert,
            variant: "outline" as const,
            className: "border-orange-500/20 text-orange-600 bg-orange-500/5 hover:bg-orange-500/10",
        },
        blocked_output: {
            label: "Blocked Output",
            icon: ShieldAlert,
            variant: "destructive" as const,
            className: "bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20",
        },
        error: {
            label: "Error",
            icon: XCircle,
            variant: "destructive" as const,
            className: "bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20",
        },
        rate_limited: {
            label: "Rate Limited",
            icon: Clock,
            variant: "secondary" as const,
            className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/20",
        },
    };

    const { label, icon: Icon, className: styles, variant } = config[status] || config.error;

    return (
        <Badge
            variant={variant}
            className={cn("gap-1.5 py-1 pl-1.5 pr-2.5 transition-colors", styles, className)}
        >
            <Icon className="h-3.5 w-3.5" />
            {label}
        </Badge>
    );
}
