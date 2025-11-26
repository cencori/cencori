'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { RequestLogsTable } from '@/components/audit/RequestLogsTable';
import { StatusBadge } from '@/components/audit/StatusBadge';
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
import { Search, X, ListFilter, Loader2 } from 'lucide-react';
import { TechnicalBorder } from '@/components/landing/TechnicalBorder';
import { useEnvironment } from '@/lib/contexts/EnvironmentContext';

interface PageProps {
    params: Promise<{
        orgSlug: string;
        projectSlug: string;
    }>;
}

export default function RequestLogsPage({ params }: PageProps) {
    const { environment } = useEnvironment();
    const [projectId, setProjectId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        status: 'all',
        model: 'all',
        time_range: '24h',
        search: '',
    });
    const [searchInput, setSearchInput] = useState('');

    // Fetch project ID from slug
    useEffect(() => {
        const fetchProjectId = async () => {
            setLoading(true);
            try {
                const { projectSlug, orgSlug } = await params;

                // First get organization ID
                const { data: orgData } = await supabase
                    .from('organizations')
                    .select('id')
                    .eq('slug', orgSlug)
                    .single();

                if (!orgData) {
                    console.error('Organization not found');
                    return;
                }

                // Then get project ID
                const { data: projectData } = await supabase
                    .from('projects')
                    .select('id')
                    .eq('slug', projectSlug)
                    .eq('organization_id', orgData.id)
                    .single();

                if (projectData) {
                    setProjectId(projectData.id);
                }
            } catch (error) {
                console.error('Error fetching project:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchProjectId();
    }, [params]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFilters(prev => ({ ...prev, search: searchInput }));
    };

    const handleClearFilters = () => {
        setFilters({
            status: 'all',
            model: 'all',
            time_range: '24h',
            search: '',
        });
        setSearchInput('');
    };

    const hasActiveFilters = filters.status !== 'all' || filters.model !== 'all' || filters.search || filters.time_range !== '24h';

    // Show loading while fetching project ID
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // Show error if project ID not found
    if (!projectId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <p className="text-lg font-medium text-muted-foreground">Project not found</p>
                <p className="text-sm text-muted-foreground mt-1">Unable to load request logs</p>
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Request Logs</h2>
                    <p className="text-muted-foreground">
                        View and monitor all AI requests for this project
                    </p>
                </div>
            </div>

            {/* Filters */}
            <TechnicalBorder>
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <ListFilter className="h-4 w-4" />
                            <h3 className="text-base font-semibold">Filters</h3>
                        </div>
                        {hasActiveFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleClearFilters}
                            >
                                <X className="mr-2 h-4 w-4" />
                                Clear filters
                            </Button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Status filter */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Status</label>
                            <Select
                                value={filters.status}
                                onValueChange={(value) =>
                                    setFilters(prev => ({ ...prev, status: value }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All statuses</SelectItem>
                                    <SelectItem value="success">Success</SelectItem>
                                    <SelectItem value="filtered">Filtered</SelectItem>
                                    <SelectItem value="blocked_output">Blocked Output</SelectItem>
                                    <SelectItem value="error">Error</SelectItem>
                                    <SelectItem value="rate_limited">Rate Limited</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Model filter */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Model</label>
                            <Select
                                value={filters.model}
                                onValueChange={(value) =>
                                    setFilters(prev => ({ ...prev, model: value }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All models" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All models</SelectItem>
                                    <SelectItem value="gemini-2.5-flash">gemini-2.5-flash</SelectItem>
                                    <SelectItem value="gemini-1.5-pro">gemini-1.5-pro</SelectItem>
                                    <SelectItem value="gemini-1.5-flash">gemini-1.5-flash</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Time range */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Time Range</label>
                            <TimeRangeSelector
                                value={filters.time_range}
                                onChange={(value) =>
                                    setFilters(prev => ({ ...prev, time_range: value }))
                                }
                            />
                        </div>

                        {/* Search */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Search</label>
                            <form onSubmit={handleSearchSubmit} className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search requests..."
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    className="pl-8"
                                />
                            </form>
                        </div>
                    </div>
                </div>
            </TechnicalBorder>

            {/* Export button */}
            <div className="flex justify-end">
                <ExportButton projectId={projectId} filters={filters} />
            </div>

            {/* Request logs table */}
            <RequestLogsTable projectId={projectId} filters={filters} environment={environment} />
        </div>
    );
}
