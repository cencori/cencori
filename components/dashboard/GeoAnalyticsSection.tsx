"use client";

/**
 * Geographic Analytics Section
 * 
 * Wraps GeoMap and RegionalCharts with a time range selector.
 */

import { useState } from "react";
import { GeoMap } from "./GeoMap";
import { RegionalCharts } from "./RegionalCharts";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Calendar, RefreshCw } from "lucide-react";

interface GeoAnalyticsSectionProps {
    projectId: string;
}

export type TimeRange = "24h" | "7d" | "30d" | "90d";

const TIME_RANGES: { value: TimeRange; label: string; days: number }[] = [
    { value: "24h", label: "Last 24 hours", days: 1 },
    { value: "7d", label: "Last 7 days", days: 7 },
    { value: "30d", label: "Last 30 days", days: 30 },
    { value: "90d", label: "Last 90 days", days: 90 },
];

export function GeoAnalyticsSection({ projectId }: GeoAnalyticsSectionProps) {
    const [timeRange, setTimeRange] = useState<TimeRange>("7d");
    const [refreshKey, setRefreshKey] = useState(0);

    const handleRefresh = () => {
        setRefreshKey((k) => k + 1);
    };

    return (
        <div className="space-y-4">
            {/* Time Range Selector */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                        <SelectTrigger className="w-40 h-8 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {TIME_RANGES.map((range) => (
                                <SelectItem key={range.value} value={range.value} className="text-xs">
                                    {range.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={handleRefresh}
                >
                    <RefreshCw className="h-3 w-3 mr-1.5" />
                    Refresh
                </Button>
            </div>

            {/* Map */}
            <GeoMap key={`map-${refreshKey}`} projectId={projectId} timeRange={timeRange} />

            {/* Charts */}
            <RegionalCharts key={`charts-${refreshKey}`} projectId={projectId} timeRange={timeRange} />
        </div>
    );
}
