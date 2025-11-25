import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: {
        value: number;
        label: string;
        direction: 'up' | 'down' | 'neutral';
    };
    description?: string;
    className?: string;
    loading?: boolean;
}

export function MetricCard({
    title,
    value,
    icon: Icon,
    trend,
    description,
    className,
    loading = false
}: MetricCardProps) {
    return (
        <Card className={cn("overflow-hidden", className)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="h-8 w-24 animate-pulse rounded bg-muted" />
                ) : (
                    <div className="flex flex-col gap-1">
                        <div className="text-2xl font-bold tracking-tight">{value}</div>

                        {(trend || description) && (
                            <div className="flex items-center text-xs text-muted-foreground">
                                {trend && (
                                    <span className={cn(
                                        "flex items-center gap-0.5 font-medium mr-2",
                                        trend.direction === 'up' && "text-green-600",
                                        trend.direction === 'down' && "text-red-600",
                                        trend.direction === 'neutral' && "text-yellow-600"
                                    )}>
                                        {trend.direction === 'up' && <TrendingUp className="h-3 w-3" />}
                                        {trend.direction === 'down' && <TrendingDown className="h-3 w-3" />}
                                        {trend.direction === 'neutral' && <Minus className="h-3 w-3" />}
                                        {Math.abs(trend.value)}%
                                    </span>
                                )}
                                <span className="truncate">{trend ? trend.label : description}</span>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
