"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Activity, DollarSign, Zap, AlertCircle } from 'lucide-react';

interface AIStats {
    totalRequests: number;
    successfulRequests: number;
    errorRequests: number;
    filteredRequests: number;
    totalCost: string;
    totalTokens: number;
    avgLatency: number;
}

export default function AIUsagePage() {
    const params = useParams();
    const projectSlug = params.projectSlug as string;

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<AIStats | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [projectId, setProjectId] = useState<string | null>(null);

    useEffect(() => {
        fetchProjectAndStats();
    }, [projectSlug]);

    async function fetchProjectAndStats() {
        try {
            setLoading(true);

            // First get project ID from slug
            const response = await fetch(`/api/projects?slug=${projectSlug}`);
            if (!response.ok) throw new Error('Failed to fetch project');

            const { projects } = await response.json();
            const project = projects?.[0];
            if (!project) throw new Error('Project not found');

            setProjectId(project.id);

            // Fetch AI stats
            const statsResponse = await fetch(`/api/projects/${project.id}/ai/stats?period=7d`);
            if (!statsResponse.ok) throw new Error('Failed to fetch stats');

            const data = await statsResponse.json();
            setStats(data.stats);
        } catch (err: unknown) {
            console.error('[AI Usage] Error:', err);
            setError(err instanceof Error ? err.message : 'Failed to load AI usage data');
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">AI Usage</h1>
                        <p className="text-muted-foreground">Monitor your AI API usage and costs</p>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map(i => (
                        <Card key={i}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-4 w-4 rounded-full" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-8 w-16 mb-2" />
                                <Skeleton className="h-3 w-24" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-destructive" />
                            Error Loading AI Usage
                        </CardTitle>
                        <CardDescription>{error || 'Unknown error occurred'}</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">AI Usage</h1>
                    <p className="text-muted-foreground">Monitor your AI API usage and costs</p>
                </div>
                <Badge variant="secondary">Last 7 days</Badge>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalRequests.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.successfulRequests} successful
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${stats.totalCost}</div>
                        <p className="text-xs text-muted-foreground">
                            ${(parseFloat(stats.totalCost) / (stats.totalRequests || 1)).toFixed(6)} per request
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
                        <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalTokens.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                            {Math.round(stats.totalTokens / (stats.totalRequests || 1))} avg per request
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.avgLatency}ms</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.errorRequests + stats.filteredRequests} failed
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* View Logs Link */}
            {projectId && (
                <div className="flex justify-center">
                    <a
                        href={`/dashboard/organizations/${params.orgSlug}/projects/${projectSlug}/ai/logs`}
                        className="text-sm text-primary hover:underline"
                    >
                        View detailed request logs →
                    </a>
                </div>
            )}
        </div>
    );
}
