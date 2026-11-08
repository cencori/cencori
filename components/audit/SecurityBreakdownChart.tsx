'use client';

import { TechnicalBorder } from '@/components/landing/TechnicalBorder';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Legend,
    Tooltip,
} from 'recharts';

interface SecurityBreakdownProps {
    data: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
}

const COLORS = {
    critical: 'hsl(0, 84%, 60%)',      // Red
    high: 'hsl(48, 96%, 53%)',         // Yellow
    medium: 'hsl(48, 96%, 53%)',       // Yellow
    low: 'hsl(240, 5%, 65%)',          // Zinc
};

export function SecurityBreakdownChart({ data }: SecurityBreakdownProps) {
    const chartData = [
        { name: 'Critical', value: data.critical, color: COLORS.critical },
        { name: 'High', value: data.high, color: COLORS.high },
        { name: 'Medium', value: data.medium, color: COLORS.medium },
        { name: 'Low', value: data.low, color: COLORS.low },
    ].filter(item => item.value > 0); // Only show non-zero values

    if (chartData.length === 0) {
        return (
            <TechnicalBorder className="h-full">
                <div className="p-6">
                    <h3 className="text-lg font-semibold leading-none tracking-tight mb-4">Security Incidents Breakdown</h3>
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                        <p className="text-sm">No security incidents 🎉</p>
                    </div>
                </div>
            </TechnicalBorder>
        );
    }

    return (
        <TechnicalBorder className="h-full">
            <div className="p-6">
                <h3 className="text-lg font-semibold leading-none tracking-tight mb-4">Security Incidents Breakdown</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={(entry) => `${entry.name}: ${entry.value}`}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                            }}
                        />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </TechnicalBorder>
    );
}
