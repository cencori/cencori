'use client';

import { TimePeriod } from '../lib/types';

interface TimeRangeSelectorProps {
    value: TimePeriod;
    onChange: (value: TimePeriod) => void;
}

const TIME_RANGES: { value: TimePeriod; label: string }[] = [
    { value: '1h', label: '1 Hour' },
    { value: '24h', label: '24 Hours' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
    { value: '1y', label: '1 Year' },
    { value: 'all', label: 'All Time' },
];

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
    return (
        <div className="inline-flex items-center rounded-lg border border-border/50 bg-muted/30 p-0.5">
            {TIME_RANGES.map((range) => (
                <button
                    key={range.value}
                    onClick={() => onChange(range.value)}
                    className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${value === range.value
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    {range.label}
                </button>
            ))}
        </div>
    );
}
