'use client';

import { useState, use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { RequestLogsTable } from '@/components/audit/RequestLogsTable';
import { LogsBarChart } from '@/components/audit/LogsBarChart';
import { TimeRangeSelector } from '@/components/audit/TimeRangeSelector';
import { ExportButton } from '@/components/audit/ExportButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import { useEnvironment } from '@/lib/contexts/EnvironmentContext';
import { Skeleton } from '@/components/ui/skeleton';

interface PageProps {
    params: Promise<{
        orgSlug: string;
        projectSlug: string;
    }>;
}

// Hook to get projectId from slugs (with caching)
function useProjectId(orgSlug: string, projectSlug: string) {
    return useQuery({
        queryKey: ["projectId", orgSlug, projectSlug],
        queryFn: async () => {
            const { data: orgData } = await supabase
                .from('organizations')
                .select('id')
                .eq('slug', orgSlug)
                .single();

            if (!orgData) throw new Error("Organization not found");

            const { data: projectData } = await supabase
                .from('projects')
                .select('id')
                .eq('slug', projectSlug)
                .eq('organization_id', orgData.id)
                .single();

            if (!projectData) throw new Error("Project not found");
            return projectData.id;
        },
        staleTime: 5 * 60 * 1000, // IDs rarely change
    });
}

export default function RequestLogsPage({ params }: PageProps) {
    const { orgSlug, projectSlug } = use(params);
    const { environment } = useEnvironment();
    const [filters, setFilters] = useState({
        status: 'all',
        model: 'all',
        time_range: '1h',
        search: '',
    });
    const [searchInput, setSearchInput] = useState('');

    // Get projectId with caching - INSTANT ON REVISIT!
    const { data: projectId, isLoading } = useProjectId(orgSlug, projectSlug);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFilters(prev => ({ ...prev, search: searchInput }));
    };

    const handleClearFilters = () => {
        setFilters({
            status: 'all',
            model: 'all',
            time_range: '30d',
            search: '',
        });
        setSearchInput('');
    };

    const hasActiveFilters = filters.status !== 'all' || filters.model !== 'all' || filters.search || filters.time_range !== '30d';

    if (isLoading) {
        return (
            <div className="w-full max-w-6xl mx-auto px-6 py-8">
                <div className="mb-8">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-3 w-48 mt-1" />
                </div>
                <div className="flex items-center gap-3 mb-6">
                    <Skeleton className="h-7 w-28" />
                    <Skeleton className="h-7 w-28" />
                    <Skeleton className="h-7 w-28" />
                    <Skeleton className="h-7 w-40" />
                </div>
                <div className="bg-card border border-border/40 rounded-md">
                    <div className="border-b border-border/40 px-4 py-2">
                        <div className="grid grid-cols-7 gap-4">
                            {[1, 2, 3, 4, 5, 6, 7].map(i => <Skeleton key={i} className="h-3 w-12" />)}
                        </div>
                    </div>
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="border-b border-border/40 px-4 py-3 last:border-b-0">
                            <div className="grid grid-cols-7 gap-4 items-center">
                                <Skeleton className="h-5 w-16" />
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-3 w-24" />
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-12" />
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-3 w-14" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!projectId) {
        return (
            <div className="w-full max-w-6xl mx-auto px-6 py-8">
                <div className="text-center py-16">
                    <p className="text-sm font-medium">Project not found</p>
                    <p className="text-xs text-muted-foreground mt-1">Unable to load request logs</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-base font-medium">Logs</h1>
                <p className="text-xs text-muted-foreground mt-0.5">View and monitor all AI requests for this project.</p>
            </div>

            {/* Logs Bar Chart */}
            <LogsBarChart projectId={projectId} timeRange={filters.time_range} environment={environment} />

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
                {/* Status filter */}
                <Select
                    value={filters.status}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                >
                    <SelectTrigger className="w-[130px] h-7 text-xs">
                        <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all" className="text-xs">All statuses</SelectItem>
                        <SelectItem value="success" className="text-xs">Success</SelectItem>
                        <SelectItem value="success_fallback" className="text-xs">Fallback Used</SelectItem>
                        <SelectItem value="filtered" className="text-xs">Filtered</SelectItem>
                        <SelectItem value="blocked_output" className="text-xs">Blocked</SelectItem>
                        <SelectItem value="error" className="text-xs">Error</SelectItem>
                        <SelectItem value="rate_limited" className="text-xs">Rate Limited</SelectItem>
                    </SelectContent>
                </Select>

                {/* Model filter */}
                <Select
                    value={filters.model}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, model: value }))}
                >
                    <SelectTrigger className="w-[150px] h-7 text-xs">
                        <SelectValue placeholder="All models" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all" className="text-xs">All models</SelectItem>
                        <SelectItem value="gpt-5" className="text-xs">gpt-5</SelectItem>
                        <SelectItem value="gpt-4o" className="text-xs">gpt-4o</SelectItem>
                        <SelectItem value="claude-opus-4" className="text-xs">claude-opus-4</SelectItem>
                        <SelectItem value="gemini-3-pro" className="text-xs">gemini-3-pro</SelectItem>
                        <SelectItem value="gemini-2.5-flash" className="text-xs">gemini-2.5-flash</SelectItem>
                        <SelectItem value="grok-4" className="text-xs">grok-4</SelectItem>
                    </SelectContent>
                </Select>

                {/* Time range */}
                <TimeRangeSelector
                    value={filters.time_range}
                    onChange={(value) => setFilters(prev => ({ ...prev, time_range: value }))}
                />

                {/* Search */}
                <form onSubmit={handleSearchSubmit} className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                        placeholder="Search requests..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="w-40 sm:w-56 h-7 pl-7 text-xs rounded border-border/50 bg-transparent placeholder:text-muted-foreground/60"
                    />
                </form>

                {/* Clear filters */}
                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={handleClearFilters}
                    >
                        <X className="h-3 w-3 mr-1" />
                        Clear
                    </Button>
                )}

                {/* Export button - pushed to right */}
                <div className="ml-auto">
                    <ExportButton projectId={projectId} filters={filters} />
                </div>
            </div>

            {/* Request logs table */}
            <RequestLogsTable projectId={projectId} filters={filters} environment={environment} />
        </div>
    );
}
