'use client';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface TimeRangeSelectorProps {
    value: string;
    onChange: (value: string) => void;
}

const timeRanges = [
    { value: '1h', label: '1 Hour' },
    { value: '24h', label: '24 Hours' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: 'all', label: 'All Time' },
];

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
    return (
        <div className="flex items-center gap-1.5">
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="w-[100px] h-7 text-xs">
                    <SelectValue placeholder="Time range" />
                </SelectTrigger>
                <SelectContent>
                    {timeRanges.map((range) => (
                        <SelectItem key={range.value} value={range.value} className="text-xs">
                            {range.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
