'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { SecurityIncidentsTable } from '@/components/audit/SecurityIncidentsTable';
import { TimeRangeSelector } from '@/components/audit/TimeRangeSelector';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { X, ListFilter, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEnvironment } from '@/lib/contexts/EnvironmentContext';

interface PageProps {
    params: Promise<{
        orgSlug: string;
        projectSlug: string;
    }>;
}

export default function SecurityIncidentsPage({ params }: PageProps) {
    const { environment } = useEnvironment();
    const [projectId, setProjectId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        severity: 'all',
        type: 'all',
        reviewed: 'all',
        time_range: '7d',
    });

    // Fetch project ID from slug
    useEffect(() => {
        const fetchProjectId = async () => {
            setLoading(true);
            try {
                const { projectSlug, orgSlug } = await params;

                const { data: orgData } = await supabase
                    .from('organizations')
                    .select('id')
                    .eq('slug', orgSlug)
                    .single();

                if (!orgData) {
                    console.error('Organization not found');
                    return;
                }

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

    const handleClearFilters = () => {
        setFilters({
            severity: 'all',
            type: 'all',
            reviewed: 'all',
            time_range: '7d',
        });
    };

    const hasActiveFilters =
        filters.severity !== 'all' ||
        filters.type !== 'all' ||
        filters.reviewed !== 'all' ||
        filters.time_range !== '7d';

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
                <p className="text-sm text-muted-foreground mt-1">Unable to load security incidents</p>
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Security Incidents</h2>
                    <p className="text-muted-foreground">
                        Monitor and review security threats detected in your AI requests
                    </p>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ListFilter className="h-4 w-4" />
                            <CardTitle className="text-base">Filters</CardTitle>
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
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Severity filter */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Severity</label>
                            <Select
                                value={filters.severity}
                                onValueChange={(value) =>
                                    setFilters(prev => ({ ...prev, severity: value }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All severities" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Severities</SelectItem>
                                    <SelectItem value="critical">Critical</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="low">Low</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Type filter */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Incident Type</label>
                            <Select
                                value={filters.type}
                                onValueChange={(value) =>
                                    setFilters(prev => ({ ...prev, type: value }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="jailbreak_attempt">Jailbreak Attempt</SelectItem>
                                    <SelectItem value="pii_detection">PII Detection</SelectItem>
                                    <SelectItem value="prompt_injection">Prompt Injection</SelectItem>
                                    <SelectItem value="harmful_content">Harmful Content</SelectItem>
                                    <SelectItem value="data_exfiltration">Data Exfiltration</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Review status */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Review Status</label>
                            <Select
                                value={filters.reviewed}
                                onValueChange={(value) =>
                                    setFilters(prev => ({ ...prev, reviewed: value }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="false">Pending Review</SelectItem>
                                    <SelectItem value="true">Reviewed</SelectItem>
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
                    </div>
                </CardContent>
            </Card>

            {/* Security incidents table */}
            <SecurityIncidentsTable projectId={projectId} filters={filters} environment={environment} />
        </div>
    );
}
