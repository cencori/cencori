'use client';

import { TechnicalBorder } from '@/components/landing/TechnicalBorder';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

interface ModelUsageProps {
    data: Record<string, number>;
}

export function ModelUsageChart({ data }: ModelUsageProps) {
    const chartData = Object.entries(data).map(([model, count]) => ({
        model: model.replace('gemini-', ''), // Shorten  names
        requests: count,
    }));

    return (
        <TechnicalBorder className="h-full">
            <div className="p-6">
                <h3 className="text-lg font-semibold leading-none tracking-tight mb-4">Model Usage</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                            dataKey="model"
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
                        <Bar
                            dataKey="requests"
                            fill="hsl(var(--primary))"
                            radius={[8, 8, 0, 0]}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </TechnicalBorder>
    );
}
