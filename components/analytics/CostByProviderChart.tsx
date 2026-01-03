'use client';

import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';

interface CostByProviderChartProps {
    data: Record<string, number>;
}

const PROVIDER_COLORS: Record<string, string> = {
    openai: 'hsl(142, 71%, 45%)',     // Green
    anthropic: 'hsl(24, 96%, 53%)',    // Orange
    google: 'hsl(217, 91%, 60%)',      // Blue
    gemini: 'hsl(217, 91%, 60%)',      // Blue
    cohere: 'hsl(262, 83%, 58%)',      // Purple
    mistral: 'hsl(340, 82%, 52%)',     // Pink
    groq: 'hsl(48, 96%, 53%)',         // Yellow
    deepseek: 'hsl(187, 100%, 42%)',   // Cyan
    unknown: 'hsl(0, 0%, 50%)',        // Gray
};

const chartConfig = {
    cost: {
        label: 'Cost',
    },
} satisfies ChartConfig;

export function CostByProviderChart({ data }: CostByProviderChartProps) {
    const chartData = Object.entries(data)
        .map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value: value,
            fill: PROVIDER_COLORS[name.toLowerCase()] || PROVIDER_COLORS.unknown,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6); // Top 6 providers

    const total = chartData.reduce((sum, item) => sum + item.value, 0);

    if (total === 0) {
        return (
            <div className="rounded-lg border border-border/40 bg-card p-4">
                <div className="mb-3">
                    <h3 className="text-xs font-medium">Cost by Provider</h3>
                    <p className="text-[10px] text-muted-foreground">Spending breakdown</p>
                </div>
                <div className="h-[180px] flex items-center justify-center">
                    <p className="text-xs text-muted-foreground">No data</p>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-border/40 bg-card p-4">
            <div className="mb-3">
                <h3 className="text-xs font-medium">Cost by Provider</h3>
                <p className="text-[10px] text-muted-foreground">
                    Total: <span className="font-mono font-medium">${total.toFixed(2)}</span>
                </p>
            </div>

            <div className="h-[180px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            layout="vertical"
                            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                        >
                            <XAxis type="number" hide />
                            <YAxis
                                type="category"
                                dataKey="name"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 10 }}
                                width={60}
                            />
                            <ChartTooltip
                                cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                                content={
                                    <ChartTooltipContent
                                        formatter={(value) => (
                                            <span className="font-mono font-medium">
                                                ${Number(value).toFixed(4)}
                                            </span>
                                        )}
                                    />
                                }
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </div>

            {/* Cost labels */}
            <div className="mt-2 space-y-1">
                {chartData.slice(0, 4).map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-1.5">
                            <div
                                className="h-2 w-2 rounded-sm shrink-0"
                                style={{ backgroundColor: item.fill }}
                            />
                            <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="font-mono">${item.value.toFixed(4)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
