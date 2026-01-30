'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Activity, Shield, Building2, FolderOpen, Key, Users, DollarSign, Zap, Settings, ScanSearch } from 'lucide-react';
import { usePlatformMetrics } from '../hooks/useMetrics';
import { MetricsCard, MetricsGrid, MetricsSection } from '../components/MetricsCard';
import { TimeRangeSelector } from '../components/TimeRangeSelector';
import type { TimePeriod } from '../lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

export function AdminDashboard() {
    const [period, setPeriod] = useState<TimePeriod>('7d');
    const { data, isLoading, error } = usePlatformMetrics(period);

    if (error) {
        return (
            <div className="w-full max-w-6xl mx-auto px-6 py-8">
                <div className="text-center py-12">
                    <p className="text-sm text-red-500">Failed to load metrics</p>
                    <p className="text-xs text-muted-foreground mt-1">{(error as Error).message}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto px-6 py-8 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold">Platform Analytics</h1>
                    <p className="text-xs text-muted-foreground">Real-time metrics across all Cencori services</p>
                </div>
                <div className="flex items-center gap-3">
                    <TimeRangeSelector value={period} onChange={setPeriod} />
                    <Link href="/internal/settings">
                        <Button variant="outline" size="sm" className="h-8 text-xs rounded-full">
                            <Settings className="h-3.5 w-3.5 mr-1.5" />
                            Team
                        </Button>
                    </Link>
                </div>
            </div>

            {isLoading ? (
                <LoadingSkeleton />
            ) : data ? (
                <>
                    {/* AI Gateway Section */}
                    <MetricsSection
                        title="AI Gateway"
                        description="Request processing and cost metrics"
                    >
                        <MetricsGrid columns={4}>
                            <MetricsCard
                                title="Total Requests"
                                value={data.aiGateway.totalRequests}
                                subtitle={`${data.aiGateway.successfulRequests} successful`}
                                subtitleColor="success"
                                icon={<Activity className="h-4 w-4" />}
                            />
                            <MetricsCard
                                title="Total Cost"
                                value={`$${data.aiGateway.totalCost.toFixed(2)}`}
                                subtitle={`${data.aiGateway.totalTokens.toLocaleString()} tokens`}
                                icon={<DollarSign className="h-4 w-4" />}
                            />
                            <MetricsCard
                                title="Avg Latency"
                                value={`${data.aiGateway.avgLatency}ms`}
                                subtitle={`${data.aiGateway.streamingRequests} streaming`}
                                icon={<Zap className="h-4 w-4" />}
                            />
                            <MetricsCard
                                title="Error Rate"
                                value={`${data.aiGateway.totalRequests > 0
                                    ? ((data.aiGateway.errorRequests / data.aiGateway.totalRequests) * 100).toFixed(1)
                                    : 0}%`}
                                subtitle={`${data.aiGateway.errorRequests} errors, ${data.aiGateway.filteredRequests} filtered`}
                                subtitleColor={data.aiGateway.errorRequests > 0 ? 'error' : 'success'}
                            />
                        </MetricsGrid>

                        {/* Provider & Model Breakdown */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <BreakdownCard
                                title="By Provider"
                                data={data.aiGateway.requestsByProvider}
                                total={data.aiGateway.totalRequests}
                            />
                            <BreakdownCard
                                title="By Model"
                                data={data.aiGateway.requestsByModel}
                                total={data.aiGateway.totalRequests}
                            />
                        </div>
                    </MetricsSection>

                    {/* Security Section */}
                    <MetricsSection
                        title="Security"
                        description="Threats detected and blocked"
                    >
                        <MetricsGrid columns={4}>
                            <MetricsCard
                                title="Total Incidents"
                                value={data.security.totalIncidents}
                                icon={<Shield className="h-4 w-4" />}
                            />
                            <MetricsCard
                                title="Critical"
                                value={data.security.incidentsBySeverity.critical}
                                subtitleColor={data.security.incidentsBySeverity.critical > 0 ? 'error' : 'default'}
                            />
                            <MetricsCard
                                title="High"
                                value={data.security.incidentsBySeverity.high}
                                subtitleColor={data.security.incidentsBySeverity.high > 0 ? 'warning' : 'default'}
                            />
                            <MetricsCard
                                title="Medium / Low"
                                value={`${data.security.incidentsBySeverity.medium} / ${data.security.incidentsBySeverity.low}`}
                            />
                        </MetricsGrid>
                    </MetricsSection>

                    {/* Organizations & Projects */}
                    <MetricsSection
                        title="Organizations & Projects"
                        description="Platform adoption metrics"
                    >
                        <MetricsGrid columns={4}>
                            <MetricsCard
                                title="Organizations"
                                value={data.organizations.total}
                                subtitle={`${data.organizations.active} active`}
                                subtitleColor="success"
                                icon={<Building2 className="h-4 w-4" />}
                            />
                            <MetricsCard
                                title="Projects"
                                value={data.projects.total}
                                subtitle={`${data.projects.active} active`}
                                subtitleColor="success"
                                icon={<FolderOpen className="h-4 w-4" />}
                            />
                            <MetricsCard
                                title="API Keys"
                                value={data.apiKeys.total}
                                subtitle={`${data.apiKeys.active} active`}
                                subtitleColor="success"
                                icon={<Key className="h-4 w-4" />}
                            />
                            <MetricsCard
                                title="Team Members"
                                value={data.organizations.totalMembers}
                                icon={<Users className="h-4 w-4" />}
                            />
                        </MetricsGrid>
                    </MetricsSection>

                    {/* Users */}
                    <MetricsSection
                        title="Users"
                        description="Signup and activity metrics"
                    >
                        <MetricsGrid columns={4}>
                            <MetricsCard
                                title="Total Users"
                                value={data.users.total}
                                subtitle={`${data.users.active} active (30d)`}
                                subtitleColor="success"
                                icon={<Users className="h-4 w-4" />}
                            />
                            <MetricsCard
                                title="New Today"
                                value={data.users.newToday}
                                subtitleColor={data.users.newToday > 0 ? 'success' : 'default'}
                            />
                            <MetricsCard
                                title="New This Week"
                                value={data.users.newThisWeek}
                            />
                            <MetricsCard
                                title="New This Month"
                                value={data.users.newThisMonth}
                            />
                        </MetricsGrid>
                    </MetricsSection>

                    {/* Billing / Revenue */}
                    <MetricsSection
                        title="Billing & Revenue"
                        description="Subscription and revenue metrics"
                    >
                        <MetricsGrid columns={4}>
                            <MetricsCard
                                title="MRR"
                                value={`$${data.billing.mrr.toLocaleString()}`}
                                subtitle={`${data.billing.activeSubscriptions} paid subscriptions`}
                                subtitleColor="success"
                                icon={<DollarSign className="h-4 w-4" />}
                            />
                            <MetricsCard
                                title="Active Subscriptions"
                                value={data.billing.activeSubscriptions}
                                subtitleColor="success"
                            />
                            <MetricsCard
                                title="Churned"
                                value={data.billing.churnedThisPeriod}
                                subtitle="this period"
                                subtitleColor={data.billing.churnedThisPeriod > 0 ? 'warning' : 'default'}
                            />
                            <MetricsCard
                                title="Avg Revenue / User"
                                value={data.billing.activeSubscriptions > 0
                                    ? `$${(data.billing.mrr / data.billing.activeSubscriptions).toFixed(0)}`
                                    : '$0'
                                }
                            />
                        </MetricsGrid>
                    </MetricsSection>

                    {/* Cencori Scan Section */}
                    <MetricsSection
                        title="Cencori Scan"
                        description="CLI usage and adoption metrics"
                    >
                        <MetricsGrid columns={4}>
                            <MetricsCard
                                title="Total Scans"
                                value={data.scan.totalScans}
                                subtitle={`${data.scan.authenticatedScans} with API key`}
                                subtitleColor="success"
                                icon={<ScanSearch className="h-4 w-4" />}
                            />
                            <MetricsCard
                                title="Conversion Rate"
                                value={`${data.scan.conversionRate}%`}
                                subtitle={`${data.scan.anonymousScans} anonymous`}
                                subtitleColor={data.scan.conversionRate > 10 ? 'success' : 'warning'}
                            />
                            <MetricsCard
                                title="Files Scanned"
                                value={data.scan.totalFilesScanned.toLocaleString()}
                                subtitle={`${data.scan.avgIssuesPerScan} avg issues/scan`}
                            />
                            <MetricsCard
                                title="Issues Found"
                                value={data.scan.totalIssuesFound.toLocaleString()}
                            />
                        </MetricsGrid>

                        {/* Score & Platform Breakdown */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <BreakdownCard
                                title="By Score"
                                data={{
                                    'A-Tier': data.scan.scoreBreakdown.A,
                                    'B-Tier': data.scan.scoreBreakdown.B,
                                    'C-Tier': data.scan.scoreBreakdown.C,
                                    'D-Tier': data.scan.scoreBreakdown.D,
                                    'F-Tier': data.scan.scoreBreakdown.F,
                                }}
                                total={data.scan.totalScans}
                            />
                            <BreakdownCard
                                title="By Platform"
                                data={{
                                    'macOS': data.scan.platformBreakdown.darwin,
                                    'Linux': data.scan.platformBreakdown.linux,
                                    'Windows': data.scan.platformBreakdown.win32,
                                    'Other': data.scan.platformBreakdown.other,
                                }}
                                total={data.scan.totalScans}
                            />
                        </div>
                    </MetricsSection>
                </>
            ) : null}

            {/* Footer */}
            <div className="text-center text-[10px] text-muted-foreground pt-4 border-t border-border/40">
                {data && `Last updated: ${new Date(data.generatedAt).toLocaleString()}`}
            </div>
        </div>
    );
}

// Breakdown card for provider/model distribution
function BreakdownCard({ title, data, total }: { title: string; data: Record<string, number>; total: number }) {
    const sortedEntries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return (
        <div className="rounded-xl border border-border/50 bg-card p-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                {title}
            </p>
            <div className="space-y-2">
                {sortedEntries.length > 0 ? sortedEntries.map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                        <div className="flex-1">
                            <div className="flex justify-between text-xs mb-0.5">
                                <span className="font-mono truncate">{key}</span>
                                <span className="text-muted-foreground">{value}</span>
                            </div>
                            <div className="h-1 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-500 rounded-full"
                                    style={{ width: `${total > 0 ? (value / total) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )) : (
                    <p className="text-xs text-muted-foreground">No data</p>
                )}
            </div>
        </div>
    );
}

// Loading skeleton
function LoadingSkeleton() {
    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <Skeleton className="h-4 w-32" />
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
            </div>
            <div className="space-y-4">
                <Skeleton className="h-4 w-24" />
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
            </div>
        </div>
    );
}
