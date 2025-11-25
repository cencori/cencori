'use client';

import { TechnicalBorder } from '@/components/landing/TechnicalBorder';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';

interface TrendData {
    timestamp: string;
    total: number;
    success: number;
    filtered: number;
    blocked_output: number;
    error: number;
}

interface RequestsChartProps {
    data: TrendData[];
    groupBy: 'hour' | 'day';
}

export function RequestsChart({ data, groupBy }: RequestsChartProps) {
    const formatXAxis = (timestamp: string) => {
        if (groupBy === 'hour') {
            // Show time only for hourly data
            return timestamp.split(' ')[1] || timestamp;
        }
        // Show date for daily data (last 5 chars = MM-DD)
        return timestamp.slice(-5);
    };

    return (
        <TechnicalBorder className="h-full">
            <div className="p-6">
                <h3 className="text-lg font-semibold leading-none tracking-tight mb-4">Requests Over Time</h3>
                <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                            dataKey="timestamp"
                            tickFormatter={formatXAxis}
                            className="text-xs"
                        />
                        <YAxis className="text-xs" />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                            }}
                        />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="total"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            name="Total"
                        />
                        <Line
                            type="monotone"
                            dataKey="success"
                            stroke="hsl(142, 71%, 45%)"
                            strokeWidth={2}
                            name="Success"
                        />
                        <Line
                            type="monotone"
                            dataKey="filtered"
                            stroke="hsl(0, 84%, 60%)"
                            strokeWidth={2}
                            name="Filtered"
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </TechnicalBorder>
    );
}
