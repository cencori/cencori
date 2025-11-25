"use client";

import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { TimeRangeSelector, TimeRangeOption } from "./TimeRangeSelector";
import { DateRange } from "react-day-picker";

interface RequestFiltersProps {
    search: string;
    onSearchChange: (value: string) => void;
    status: string;
    onStatusChange: (value: string) => void;
    model: string;
    onModelChange: (value: string) => void;
    timeRange: TimeRangeOption;
    onTimeRangeChange: (value: TimeRangeOption, range?: DateRange) => void;
    dateRange?: DateRange;
    className?: string;
}

export function RequestFilters({
    search,
    onSearchChange,
    status,
    onStatusChange,
    model,
    onModelChange,
    timeRange,
    onTimeRangeChange,
    dateRange,
    className,
}: RequestFiltersProps) {
    return (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-2">
                <div className="relative flex-1 md:max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search requests..."
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="pl-9 h-9"
                    />
                </div>

                <Select value={status} onValueChange={onStatusChange}>
                    <SelectTrigger className="w-[130px] h-9">
                        <div className="flex items-center gap-2">
                            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                            <SelectValue placeholder="Status" />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="filtered">Filtered</SelectItem>
                        <SelectItem value="blocked_output">Blocked Output</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={model} onValueChange={onModelChange}>
                    <SelectTrigger className="w-[130px] h-9">
                        <SelectValue placeholder="Model" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Models</SelectItem>
                        <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                        <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                        <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <TimeRangeSelector
                value={timeRange}
                onChange={onTimeRangeChange}
                dateRange={dateRange}
            />
        </div>
    );
}
