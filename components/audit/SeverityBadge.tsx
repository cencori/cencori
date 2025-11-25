import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    AlertOctagon,
    AlertTriangle,
    Info,
    AlertCircle
} from "lucide-react";

type SeverityType = 'low' | 'medium' | 'high' | 'critical';

interface SeverityBadgeProps {
    severity: SeverityType;
    className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
    const config = {
        critical: {
            label: "CRITICAL",
            icon: AlertOctagon,
            className: "border-red-600/30 bg-red-600/10 text-red-600 hover:bg-red-600/20 animate-pulse-slow",
        },
        high: {
            label: "HIGH",
            icon: AlertTriangle,
            className: "border-orange-500/30 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20",
        },
        medium: {
            label: "MEDIUM",
            icon: AlertCircle,
            className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20",
        },
        low: {
            label: "LOW",
            icon: Info,
            className: "border-blue-500/30 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20",
        },
    };

    const { label, icon: Icon, className: styles } = config[severity] || config.low;

    return (
        <Badge
            variant="outline"
            className={cn("gap-1.5 py-1 pl-1.5 pr-2.5 font-mono font-medium tracking-wide", styles, className)}
        >
            <Icon className="h-3.5 w-3.5" />
            {label}
        </Badge>
    );
}
