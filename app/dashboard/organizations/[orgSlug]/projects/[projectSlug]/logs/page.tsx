'use client';

import { useState, use } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { RequestLogsTable } from '@/components/audit/RequestLogsTable';
import { ApiGatewayLogsTable } from '@/components/audit/ApiGatewayLogsTable';
import { WebRequestLogsTable } from '@/components/audit/WebRequestLogsTable';
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
import { cn } from '@/lib/utils';

interface PageProps {
    params: Promise<{
        orgSlug: string;
        projectSlug: string;
    }>;
}

interface ApiKey {
    id: string;
    name: string;
    key_prefix: string;
    environment: string | null;
}

type LogSource = 'ai' | 'api' | 'web';

// Hook to get projectId from slugs (with caching)
function useProjectId(orgSlug: string, projectSlug: string) {
    return useQuery({
        queryKey: ['projectId', orgSlug, projectSlug],
        queryFn: async () => {
            const { data: orgData } = await supabase
                .from('organizations')
                .select('id')
                .eq('slug', orgSlug)
                .single();

            if (!orgData) throw new Error('Organization not found');

            const { data: projectData } = await supabase
                .from('projects')
                .select('id')
                .eq('slug', projectSlug)
                .eq('organization_id', orgData.id)
                .single();

            if (!projectData) throw new Error('Project not found');
            return projectData.id;
        },
        staleTime: 5 * 60 * 1000, // IDs rarely change
    });
}

export default function RequestLogsPage({ params }: PageProps) {
    const { orgSlug, projectSlug } = use(params);
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const { environment } = useEnvironment();

    const sourceParam = searchParams.get('source');
    const source: LogSource = sourceParam === 'api' || sourceParam === 'web' ? sourceParam : 'ai';

    const [aiFilters, setAiFilters] = useState({
        status: 'all',
        model: 'all',
        time_range: '7d',
        search: '',
        api_key_id: 'all',
    });
    const [apiFilters, setApiFilters] = useState({
        status: 'all',
        method: 'all',
        time_range: '7d',
        search: '',
        api_key_id: 'all',
    });
    const [webFilters, setWebFilters] = useState({
        status: 'all',
        method: 'all',
        time_range: '7d',
        search: '',
    });

    const [aiSearchInput, setAiSearchInput] = useState('');
    const [apiSearchInput, setApiSearchInput] = useState('');
    const [webSearchInput, setWebSearchInput] = useState('');

    // Get projectId with caching - INSTANT ON REVISIT!
    const { data: projectId, isLoading } = useProjectId(orgSlug, projectSlug);

    // Fetch API keys for dropdown filter
    const { data: apiKeys } = useQuery<ApiKey[]>({
        queryKey: ['api-keys-filter', projectId, environment],
        queryFn: async () => {
            const { data } = await supabase
                .from('api_keys')
                .select('id, name, key_prefix, environment')
                .eq('project_id', projectId)
                .is('revoked_at', null);
            return (data as ApiKey[]) || [];
        },
        enabled: !!projectId,
        staleTime: 60 * 1000,
    });

    const setLogSource = (nextSource: LogSource) => {
        const nextParams = new URLSearchParams(searchParams.toString());

        if (nextSource === 'ai') {
            nextParams.delete('source');
        } else {
            nextParams.set('source', nextSource);
        }

        const queryString = nextParams.toString();
        router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    };

    // Filter API keys by current environment
    const filteredApiKeys = apiKeys?.filter((key) => {
        if (key.environment) {
            return environment === 'production'
                ? key.environment === 'production'
                : key.environment === 'test';
        }
        // Legacy keys without explicit environment
        const isTestKey = key.key_prefix?.includes('_test') || key.key_prefix?.includes('test_');
        return environment === 'production' ? !isTestKey : isTestKey;
    });

    const handleAiSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setAiFilters((prev) => ({ ...prev, search: aiSearchInput }));
    };

    const handleApiSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setApiFilters((prev) => ({ ...prev, search: apiSearchInput }));
    };

    const handleWebSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setWebFilters((prev) => ({ ...prev, search: webSearchInput }));
    };

    const handleClearAiFilters = () => {
        setAiFilters({
            status: 'all',
            model: 'all',
            time_range: '7d',
            search: '',
            api_key_id: 'all',
        });
        setAiSearchInput('');
    };

    const handleClearApiFilters = () => {
        setApiFilters({
            status: 'all',
            method: 'all',
            time_range: '7d',
            search: '',
            api_key_id: 'all',
        });
        setApiSearchInput('');
    };

    const handleClearWebFilters = () => {
        setWebFilters({
            status: 'all',
            method: 'all',
            time_range: '7d',
            search: '',
        });
        setWebSearchInput('');
    };

    const hasActiveAiFilters =
        aiFilters.status !== 'all'
        || aiFilters.model !== 'all'
        || aiFilters.search.length > 0
        || aiFilters.time_range !== '7d'
        || aiFilters.api_key_id !== 'all';

    const hasActiveApiFilters =
        apiFilters.status !== 'all'
        || apiFilters.method !== 'all'
        || apiFilters.search.length > 0
        || apiFilters.time_range !== '7d'
        || apiFilters.api_key_id !== 'all';

    const hasActiveWebFilters =
        webFilters.status !== 'all'
        || webFilters.method !== 'all'
        || webFilters.search.length > 0
        || webFilters.time_range !== '7d';

    if (isLoading) {
        return (
            <div className="w-full max-w-[1360px] mx-auto px-6 py-8">
                <div className="mb-8">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-3 w-56 mt-1" />
                </div>
                <div className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-6">
                    <div className="mb-4 lg:mb-0">
                        <Skeleton className="h-28 w-full max-w-[180px]" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <Skeleton className="h-7 w-28" />
                            <Skeleton className="h-7 w-28" />
                            <Skeleton className="h-7 w-28" />
                            <Skeleton className="h-7 w-40" />
                        </div>
                        <div className="bg-card border border-border/40 rounded-md">
                            <div className="border-b border-border/40 px-4 py-2">
                                <div className="grid grid-cols-7 gap-4">
                                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                                        <Skeleton key={i} className="h-3 w-12" />
                                    ))}
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
                </div>
            </div>
        );
    }

    if (!projectId) {
        return (
            <div className="w-full max-w-[1360px] mx-auto px-6 py-8">
                <div className="text-center py-16">
                    <p className="text-sm font-medium">Project not found</p>
                    <p className="text-xs text-muted-foreground mt-1">Unable to load request logs</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1360px] mx-auto px-6 py-8">
            <div className="mb-6">
                <h1 className="text-base font-medium">Logs</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                    {source === 'ai'
                        ? 'View and monitor all AI requests for this project.'
                        : source === 'api'
                            ? 'Track HTTP traffic to API gateway endpoints separately from AI token logs.'
                            : 'Monitor dashboard web gateway requests (host/path/status/message) for this project.'}
                </p>
              </div>

            <div className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-6">
                <aside className="mb-4 lg:mb-0 lg:-ml-2">
                    <nav className="flex lg:flex-col gap-2 rounded-md">
                        <button
                            type="button"
                            onClick={() => setLogSource('ai')}
                            className={cn(
                                'flex items-center gap-2 h-8 px-2.5 rounded text-xs text-left transition-colors',
                                source === 'ai'
                                    ? 'bg-secondary text-foreground font-medium'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                            )}
                        >
                            AI Gateway Logs
                        </button>
                        <button
                            type="button"
                            onClick={() => setLogSource('api')}
                            className={cn(
                                'flex items-center gap-2 h-8 px-2.5 rounded text-xs text-left transition-colors',
                                source === 'api'
                                    ? 'bg-secondary text-foreground font-medium'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                            )}
                        >
                            API Gateway
                        </button>
                        <button
                            type="button"
                            onClick={() => setLogSource('web')}
                            className={cn(
                                'flex items-center gap-2 h-8 px-2.5 rounded text-xs text-left transition-colors',
                                source === 'web'
                                    ? 'bg-secondary text-foreground font-medium'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                            )}
                        >
                            Web Gateway
                        </button>
                    </nav>
                </aside>

                <div className="min-w-0">
                    {source === 'ai' ? (
                        <>
                            <LogsBarChart
                                projectId={projectId}
                                timeRange={aiFilters.time_range}
                                environment={environment}
                                source="ai"
                            />

                            <div className="flex flex-wrap items-center gap-3 mb-4">
                                <Select
                                    value={aiFilters.status}
                                    onValueChange={(value) => setAiFilters((prev) => ({ ...prev, status: value }))}
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

                                <Select
                                    value={aiFilters.model}
                                    onValueChange={(value) => setAiFilters((prev) => ({ ...prev, model: value }))}
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

                                <TimeRangeSelector
                                    value={aiFilters.time_range}
                                    onChange={(value) => setAiFilters((prev) => ({ ...prev, time_range: value }))}
                                />

                                <Select
                                    value={aiFilters.api_key_id}
                                    onValueChange={(value) => setAiFilters((prev) => ({ ...prev, api_key_id: value }))}
                                >
                                    <SelectTrigger className="w-[190px] h-7 text-xs">
                                        <SelectValue placeholder="All API keys" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all" className="text-xs">All API keys</SelectItem>
                                        {filteredApiKeys?.map((key) => (
                                            <SelectItem key={key.id} value={key.id} className="text-xs">
                                                {key.name} ({key.key_prefix}...)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <form onSubmit={handleAiSearchSubmit} className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                    <Input
                                        placeholder="Search AI requests..."
                                        value={aiSearchInput}
                                        onChange={(e) => setAiSearchInput(e.target.value)}
                                        className="w-40 sm:w-56 h-7 pl-7 text-xs rounded border-border/50 bg-transparent placeholder:text-muted-foreground/60"
                                    />
                                </form>

                                {hasActiveAiFilters && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs px-2"
                                        onClick={handleClearAiFilters}
                                    >
                                        <X className="h-3 w-3 mr-1" />
                                        Clear
                                    </Button>
                                )}

                                <div className="ml-auto">
                                    <ExportButton projectId={projectId} filters={aiFilters} environment={environment} />
                                </div>
                            </div>

                            <RequestLogsTable projectId={projectId} filters={aiFilters} environment={environment} />
                        </>
                    ) : source === 'api' ? (
                        <>
                            <LogsBarChart
                                projectId={projectId}
                                timeRange={apiFilters.time_range}
                                environment={environment}
                                source="api"
                            />

                            <div className="flex flex-wrap items-center gap-3 mb-4">
                                <Select
                                    value={apiFilters.status}
                                    onValueChange={(value) => setApiFilters((prev) => ({ ...prev, status: value }))}
                                >
                                    <SelectTrigger className="w-[138px] h-7 text-xs">
                                        <SelectValue placeholder="All statuses" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all" className="text-xs">All statuses</SelectItem>
                                        <SelectItem value="2xx" className="text-xs">2xx Success</SelectItem>
                                        <SelectItem value="4xx" className="text-xs">4xx Client</SelectItem>
                                        <SelectItem value="5xx" className="text-xs">5xx Server</SelectItem>
                                        <SelectItem value="429" className="text-xs">429 Rate Limited</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={apiFilters.method}
                                    onValueChange={(value) => setApiFilters((prev) => ({ ...prev, method: value }))}
                                >
                                    <SelectTrigger className="w-[130px] h-7 text-xs whitespace-nowrap">
                                        <SelectValue placeholder="Method" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all" className="text-xs">All methods</SelectItem>
                                        <SelectItem value="GET" className="text-xs">GET</SelectItem>
                                        <SelectItem value="POST" className="text-xs">POST</SelectItem>
                                        <SelectItem value="PUT" className="text-xs">PUT</SelectItem>
                                        <SelectItem value="PATCH" className="text-xs">PATCH</SelectItem>
                                        <SelectItem value="DELETE" className="text-xs">DELETE</SelectItem>
                                    </SelectContent>
                                </Select>

                                <TimeRangeSelector
                                    value={apiFilters.time_range}
                                    onChange={(value) => setApiFilters((prev) => ({ ...prev, time_range: value }))}
                                />

                                <Select
                                    value={apiFilters.api_key_id}
                                    onValueChange={(value) => setApiFilters((prev) => ({ ...prev, api_key_id: value }))}
                                >
                                    <SelectTrigger className="w-[190px] h-7 text-xs">
                                        <SelectValue placeholder="All API keys" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all" className="text-xs">All API keys</SelectItem>
                                        {filteredApiKeys?.map((key) => (
                                            <SelectItem key={key.id} value={key.id} className="text-xs">
                                                {key.name} ({key.key_prefix}...)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <form onSubmit={handleApiSearchSubmit} className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                    <Input
                                        placeholder="Search paths, caller domain, request ID, or errors..."
                                        value={apiSearchInput}
                                        onChange={(e) => setApiSearchInput(e.target.value)}
                                        className="w-48 sm:w-64 h-7 pl-7 text-xs rounded border-border/50 bg-transparent placeholder:text-muted-foreground/60"
                                    />
                                </form>

                                {hasActiveApiFilters && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs px-2"
                                        onClick={handleClearApiFilters}
                                    >
                                        <X className="h-3 w-3 mr-1" />
                                        Clear
                                    </Button>
                                )}
                            </div>

                            <ApiGatewayLogsTable projectId={projectId} filters={apiFilters} environment={environment} />
                        </>
                    ) : (
                        <>
                            <LogsBarChart
                                projectId={projectId}
                                timeRange={webFilters.time_range}
                                source="web"
                            />

                            <div className="flex flex-wrap items-center gap-3 mb-4">
                                <Select
                                    value={webFilters.status}
                                    onValueChange={(value) => setWebFilters((prev) => ({ ...prev, status: value }))}
                                >
                                    <SelectTrigger className="w-[138px] h-7 text-xs">
                                        <SelectValue placeholder="All statuses" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all" className="text-xs">All statuses</SelectItem>
                                        <SelectItem value="2xx" className="text-xs">2xx Success</SelectItem>
                                        <SelectItem value="3xx" className="text-xs">3xx Redirect</SelectItem>
                                        <SelectItem value="4xx" className="text-xs">4xx Client</SelectItem>
                                        <SelectItem value="5xx" className="text-xs">5xx Server</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={webFilters.method}
                                    onValueChange={(value) => setWebFilters((prev) => ({ ...prev, method: value }))}
                                >
                                    <SelectTrigger className="w-[130px] h-7 text-xs whitespace-nowrap">
                                        <SelectValue placeholder="Method" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all" className="text-xs">All methods</SelectItem>
                                        <SelectItem value="GET" className="text-xs">GET</SelectItem>
                                        <SelectItem value="HEAD" className="text-xs">HEAD</SelectItem>
                                        <SelectItem value="POST" className="text-xs">POST</SelectItem>
                                        <SelectItem value="PUT" className="text-xs">PUT</SelectItem>
                                        <SelectItem value="PATCH" className="text-xs">PATCH</SelectItem>
                                        <SelectItem value="DELETE" className="text-xs">DELETE</SelectItem>
                                    </SelectContent>
                                </Select>

                                <TimeRangeSelector
                                    value={webFilters.time_range}
                                    onChange={(value) => setWebFilters((prev) => ({ ...prev, time_range: value }))}
                                />

                                <form onSubmit={handleWebSearchSubmit} className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                    <Input
                                        placeholder="Search host, path, message..."
                                        value={webSearchInput}
                                        onChange={(e) => setWebSearchInput(e.target.value)}
                                        className="w-48 sm:w-64 h-7 pl-7 text-xs rounded border-border/50 bg-transparent placeholder:text-muted-foreground/60"
                                    />
                                </form>

                                {hasActiveWebFilters && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs px-2"
                                        onClick={handleClearWebFilters}
                                    >
                                        <X className="h-3 w-3 mr-1" />
                                        Clear
                                    </Button>
                                )}
                            </div>

                            <WebRequestLogsTable projectId={projectId} filters={webFilters} />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
