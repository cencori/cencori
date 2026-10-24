"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
    Check,
    Copy,
    Download,
    FileJson,
    FileText,
    LockKeyhole,
    Search,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureUpgradeWall } from "@/components/billing/FeatureUpgradeWall";
import { UpgradeDialog } from "@/components/billing/UpgradeDialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { useOrganizationProject } from "@/lib/contexts/OrganizationProjectContext";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { hasFeature, type SubscriptionTier } from "@/lib/entitlements";
import { fetchJsonWithFeatureGate, isFeatureGateError } from "@/lib/feature-gate-client";
import { supabase } from "@/lib/supabaseClient";

interface AuditLogEntry {
    id: string;
    category: string;
    action: string;
    resource_type: string;
    resource_id: string | null;
    project_id: string | null;
    actor_email: string | null;
    actor_ip: string | null;
    actor_type: string;
    description: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

interface Project {
    id: string;
    name: string;
}

interface OrganizationContext {
    id: string;
    name: string;
    subscription_tier: SubscriptionTier;
    projects: Project[];
}

interface AuditLogResponse {
    logs: AuditLogEntry[];
    pagination: {
        page: number;
        per_page: number;
        total: number;
        total_pages: number;
    };
}

const CATEGORIES = [
    { value: "all", label: "All events" },
    { value: "project", label: "Projects" },
    { value: "api_key", label: "API keys" },
    { value: "agent", label: "Agents" },
    { value: "member", label: "Members" },
    { value: "security", label: "Security" },
    { value: "billing", label: "Billing" },
    { value: "provider", label: "Providers" },
    { value: "webhook", label: "Webhooks" },
    { value: "sso", label: "SSO" },
    { value: "settings", label: "Settings" },
    { value: "budget", label: "Budgets" },
    { value: "prompt", label: "Prompts" },
    { value: "cache", label: "Cache" },
    { value: "integration", label: "Integrations" },
    { value: "memory", label: "Memory" },
    { value: "export", label: "Exports" },
] as const;

const TIME_RANGES = [
    { value: "1h", label: "Last hour" },
    { value: "24h", label: "Last 24 hours" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "90d", label: "Last 90 days" },
    { value: "all", label: "All time" },
] as const;

const TEAM_ONLY_CATEGORIES = new Set(["api_key", "member", "sso"]);
const TEAM_ONLY_TIME_RANGES = new Set(["30d", "90d"]);

const VALID_CATEGORIES: ReadonlySet<string> = new Set(CATEGORIES.map((category) => category.value));

function getDevelopmentPreviewTier(value: string | null): SubscriptionTier | null {
    if (process.env.NODE_ENV !== "development") return null;
    return value === "pro" || value === "team" || value === "enterprise"
        ? value
        : null;
}

function labelForValue<T extends readonly { value: string; label: string }[]>(
    options: T,
    value: string,
) {
    return options.find((option) => option.value === value)?.label || value;
}

function categoryLabel(value: string) {
    return labelForValue(CATEGORIES, value).replace(/s$/, "");
}

function categoryBadge(value: string) {
    return value === "security"
        ? "bg-red-500/20 text-red-400"
        : "bg-emerald-500/20 text-emerald-400";
}

// Supabase-style timestamp, matching the request logs: "02 Jan 26 17:41:47"
function formatLogTimestamp(value: string) {
    const date = new Date(value);
    const day = date.getDate().toString().padStart(2, "0");
    const month = date.toLocaleString("en-US", { month: "short" });
    const year = date.getFullYear().toString().slice(-2);
    const time = date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
    return `${day} ${month} ${year} ${time}`;
}

function AuditLogTableSkeleton() {
    return (
        <div className="bg-card border border-border/40 rounded-md overflow-hidden">
            <div className="border-b border-border/40 px-4 py-2">
                <div className="grid grid-cols-6 gap-4">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-12 ml-auto" />
                </div>
            </div>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="border-b border-border/40 px-4 py-3 last:border-b-0">
                    <div className="grid grid-cols-6 gap-4 items-center">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-full max-w-[220px]" />
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-16 ml-auto" />
                    </div>
                </div>
            ))}
        </div>
    );
}

interface PageProps {
    params: Promise<{ orgSlug: string }>;
}

export default function AuditLogPage({ params }: PageProps) {
    const { orgSlug } = use(params);
    const searchParams = useSearchParams();
    const routeCategory = searchParams.get("category");
    const checkoutId = searchParams.get("checkout_session_id") || searchParams.get("checkout_id");
    const previewTier = getDevelopmentPreviewTier(searchParams.get("preview_plan"));
    const [category, setCategory] = useState(() => (
        routeCategory && VALID_CATEGORIES.has(routeCategory) ? routeCategory : "all"
    ));
    const [timeRange, setTimeRange] = useState("7d");
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [projectFilter, setProjectFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [teamUpgradeOpen, setTeamUpgradeOpen] = useState(false);
    const [metadataCopied, setMetadataCopied] = useState(false);
    const {
        organizations,
        projects: cachedProjects,
    } = useOrganizationProject();

    const cachedOrganizationContext = useMemo<OrganizationContext | undefined>(() => {
        const organization = organizations.find((item) => item.slug === orgSlug);
        if (!organization) return undefined;

        return {
            id: organization.id,
            name: organization.name,
            subscription_tier: (organization.subscription_tier || "free") as SubscriptionTier,
            projects: cachedProjects
                .filter((project) => project.organization_id === organization.id)
                .map((project) => ({ id: project.id, name: project.name }))
                .sort((left, right) => left.name.localeCompare(right.name)),
        };
    }, [organizations, cachedProjects, orgSlug]);

    useEffect(() => {
        if (routeCategory && VALID_CATEGORIES.has(routeCategory)) {
            setCategory(routeCategory);
            setPage(1);
            setSelectedEventId(null);
        }
    }, [routeCategory]);

    const {
        data: organizationContext,
        isLoading: isContextLoading,
        isError: isContextError,
        refetch: refetchOrganizationContext,
    } = useQuery<OrganizationContext>({
        queryKey: ["auditLogContext", orgSlug],
        queryFn: async () => {
            const { data: organization, error: organizationError } = await supabase
                .from("organizations")
                .select("id, name, subscription_tier")
                .eq("slug", orgSlug)
                .single();

            if (organizationError || !organization) {
                throw new Error("Organization not found");
            }

            const { data: projects } = await supabase
                .from("projects")
                .select("id, name")
                .eq("organization_id", organization.id)
                .order("name");

            return {
                id: organization.id,
                name: organization.name,
                subscription_tier: (organization.subscription_tier || "free") as SubscriptionTier,
                projects: (projects || []) as Project[],
            };
        },
        initialData: cachedOrganizationContext,
        initialDataUpdatedAt: cachedOrganizationContext ? 0 : undefined,
        staleTime: 60_000,
    });

    const effectiveTier = previewTier || organizationContext?.subscription_tier || "free";
    const auditLogsEnabled = hasFeature(effectiveTier, "auditLogs");
    const identityEventsEnabled = hasFeature(effectiveTier, "auditLogIdentityEvents");
    const extendedHistoryEnabled = hasFeature(effectiveTier, "auditLogExtendedHistory");
    const allTimeHistoryEnabled = hasFeature(effectiveTier, "auditLogAllTimeHistory");
    const auditExportsEnabled = hasFeature(effectiveTier, "auditLogExports");

    useEffect(() => {
        if (!organizationContext) return;
        if (!identityEventsEnabled && TEAM_ONLY_CATEGORIES.has(category)) {
            setCategory("all");
            setPage(1);
            setSelectedEventId(null);
        }
        if (!allTimeHistoryEnabled && timeRange === "all") {
            setTimeRange(extendedHistoryEnabled ? "90d" : "7d");
            setPage(1);
            setSelectedEventId(null);
        } else if (!extendedHistoryEnabled && TEAM_ONLY_TIME_RANGES.has(timeRange)) {
            setTimeRange("7d");
            setPage(1);
            setSelectedEventId(null);
        }
    }, [allTimeHistoryEnabled, category, extendedHistoryEnabled, identityEventsEnabled, organizationContext, timeRange]);

    const {
        data,
        isLoading,
        isFetching,
        isError,
        error: auditLogError,
        refetch,
    } = useQuery<AuditLogResponse>({
        queryKey: ["auditLogs", orgSlug, category, timeRange, search, projectFilter, page, previewTier],
        queryFn: async () => {
            const query = new URLSearchParams({
                category,
                time_range: timeRange,
                page: String(page),
                per_page: "50",
            });
            if (search) query.set("search", search);
            if (projectFilter !== "all") query.set("project_id", projectFilter);
            if (previewTier) query.set("preview_plan", previewTier);

            return fetchJsonWithFeatureGate<AuditLogResponse>(
                `/api/organizations/${orgSlug}/audit-logs?${query}`,
            );
        },
        enabled: auditLogsEnabled,
        placeholderData: (previousData) => previousData,
        retry: (failureCount, error) => !isFeatureGateError(error) && failureCount < 1,
    });

    const isAuditLogLocked = Boolean(organizationContext && !auditLogsEnabled)
        || isFeatureGateError(auditLogError);

    useEffect(() => {
        if (!checkoutId) return;

        let completed = false;
        const refreshEntitlement = async () => {
            const result = await refetchOrganizationContext();
            if (result.data && hasFeature(result.data.subscription_tier, "auditLogs")) {
                completed = true;
                window.clearInterval(refreshTimer);
                sessionStorage.removeItem(`cencori:stripe-checkout:${checkoutId}`);

                const currentUrl = new URL(window.location.href);
                currentUrl.searchParams.delete("checkout_session_id");
                currentUrl.searchParams.delete("checkout_id");
                window.history.replaceState({}, "", `${currentUrl.pathname}${currentUrl.search}`);
                toast.success("Audit log unlocked");
            }
        };

        const refreshTimer = window.setInterval(() => {
            if (!completed) void refreshEntitlement();
        }, 2_000);
        void refreshEntitlement();

        const stopTimer = window.setTimeout(() => {
            window.clearInterval(refreshTimer);
        }, 30_000);

        return () => {
            window.clearInterval(refreshTimer);
            window.clearTimeout(stopTimer);
        };
    }, [checkoutId, refetchOrganizationContext]);

    const projects = useMemo(
        () => organizationContext?.projects || [],
        [organizationContext?.projects],
    );
    const projectNames = useMemo(
        () => new Map(projects.map((project) => [project.id, project.name])),
        [projects],
    );
    const logs = data?.logs || [];
    const selectedEvent = selectedEventId
        ? logs.find((log) => log.id === selectedEventId) || null
        : null;
    const pagination = data?.pagination;
    const totalEvents = pagination?.total || 0;

    const resetPageState = () => {
        setPage(1);
        setSelectedEventId(null);
    };

    const handleSearch = () => {
        setSearch(searchInput.trim());
        resetPageState();
    };

    const handleCopyMetadata = async (event: AuditLogEntry) => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(event.metadata || {}, null, 2));
            setMetadataCopied(true);
            window.setTimeout(() => setMetadataCopied(false), 1500);
        } catch {
            toast.error("Could not copy metadata");
        }
    };

    const handleExport = (format: "csv" | "json") => {
        const query = new URLSearchParams({
            format,
            category,
            time_range: timeRange,
        });
        if (search) query.set("search", search);
        if (projectFilter !== "all") query.set("project_id", projectFilter);
        if (previewTier) query.set("preview_plan", previewTier);
        window.open(`/api/organizations/${orgSlug}/audit-logs?${query}`, "_blank", "noopener,noreferrer");
    };

    const actorLabel = (log: AuditLogEntry) => log.actor_email || (log.actor_type === "system" ? "Cencori system" : log.actor_type);
    const scopeLabel = (log: AuditLogEntry) => log.project_id ? projectNames.get(log.project_id) || "Project" : "Organization";
    const hasActiveFilters = Boolean(search) || category !== "all" || projectFilter !== "all" || timeRange !== "7d";
    const totalPages = pagination?.total_pages || 1;

    const handleClearFilters = () => {
        setCategory("all");
        setTimeRange("7d");
        setProjectFilter("all");
        setSearch("");
        setSearchInput("");
        resetPageState();
    };

    const pageHeader = (
        <div className="mb-6">
            <h1 className="text-base font-medium">Audit log</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
                Administrative changes across {organizationContext?.name || "this organization"}: who changed what, where, and when.
            </p>
        </div>
    );

    if (isContextLoading) {
        return (
            <div className="w-full max-w-[1360px] mx-auto px-6 py-8">
                {pageHeader}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <Skeleton className="h-7 w-[130px]" />
                    <Skeleton className="h-7 w-[120px]" />
                    <Skeleton className="h-7 w-[150px]" />
                    <Skeleton className="h-7 w-40 sm:w-56" />
                </div>
                <AuditLogTableSkeleton />
            </div>
        );
    }

    if (isContextError || !organizationContext) {
        return (
            <div className="w-full max-w-[1360px] mx-auto px-6 py-8">
                {pageHeader}
                <div className="text-center py-16">
                    <p className="text-sm font-medium">Organization unavailable</p>
                    <p className="text-xs text-muted-foreground mt-1">Cencori could not verify this organization&apos;s audit-log access.</p>
                    <Button variant="outline" size="sm" className="mt-4 h-7 text-xs" onClick={() => void refetchOrganizationContext()}>
                        Try again
                    </Button>
                </div>
            </div>
        );
    }

    if (isAuditLogLocked) {
        return (
            <div className="w-full max-w-[1360px] mx-auto px-6 py-8">
                {pageHeader}
                <FeatureUpgradeWall
                    orgSlug={orgSlug}
                    orgId={organizationContext.id}
                    orgName={organizationContext.name}
                    currentTier={organizationContext.subscription_tier}
                    feature="Audit log"
                    message="Audit logs are available on Pro, Team, and Enterprise. Upgrade to keep a searchable record of administrative changes."
                    returnPath={`/${orgSlug}/~/audit-log${routeCategory ? `?category=${encodeURIComponent(routeCategory)}` : ""}`}
                />
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1360px] mx-auto px-6 py-8">
            {pageHeader}

            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <Select
                        value={category}
                        onValueChange={(value) => {
                            setCategory(value);
                            resetPageState();
                        }}
                    >
                        <SelectTrigger className="w-[130px] h-7 text-xs shadow-none dark:shadow-xs">
                            <SelectValue placeholder="All events" />
                        </SelectTrigger>
                        <SelectContent>
                            {CATEGORIES.map((option) => (
                                !identityEventsEnabled && TEAM_ONLY_CATEGORIES.has(option.value)
                                    ? <LockedSelectOption key={option.value} label={option.label} />
                                    : (
                                        <SelectItem key={option.value} value={option.value} className="text-xs">
                                            {option.label}
                                        </SelectItem>
                                    )
                            ))}
                        </SelectContent>
                    </Select>

                    <Select
                        value={timeRange}
                        onValueChange={(value) => {
                            setTimeRange(value);
                            resetPageState();
                        }}
                    >
                        <SelectTrigger className="w-[120px] h-7 text-xs shadow-none dark:shadow-xs">
                            <SelectValue placeholder="Time range" />
                        </SelectTrigger>
                        <SelectContent>
                            {TIME_RANGES.map((option) => (
                                option.value === "all" && !allTimeHistoryEnabled
                                    ? <LockedSelectOption key={option.value} label={option.label} requiredTier="Enterprise" />
                                    : !extendedHistoryEnabled && TEAM_ONLY_TIME_RANGES.has(option.value)
                                    ? <LockedSelectOption key={option.value} label={option.label} requiredTier="Team" />
                                    : (
                                        <SelectItem key={option.value} value={option.value} className="text-xs">
                                            {option.label}
                                        </SelectItem>
                                    )
                            ))}
                        </SelectContent>
                    </Select>

                    <Select
                        value={projectFilter}
                        onValueChange={(value) => {
                            setProjectFilter(value);
                            resetPageState();
                        }}
                    >
                        <SelectTrigger className="w-[150px] h-7 text-xs shadow-none dark:shadow-xs">
                            <SelectValue placeholder="All projects" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all" className="text-xs">All projects</SelectItem>
                            {projects.map((project) => (
                                <SelectItem key={project.id} value={project.id} className="text-xs">
                                    {project.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <form
                        className="relative"
                        onSubmit={(event) => {
                            event.preventDefault();
                            handleSearch();
                        }}
                    >
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                            aria-label="Search audit events"
                            placeholder="Search events..."
                            value={searchInput}
                            onChange={(event) => setSearchInput(event.target.value)}
                            className="w-40 sm:w-56 h-7 pl-7 text-xs rounded border-border/50 bg-transparent placeholder:text-muted-foreground/60 shadow-none dark:shadow-xs"
                        />
                    </form>

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

                    <div className="ml-auto">
                        {auditExportsEnabled ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-7 text-xs shadow-none dark:shadow-xs">
                                        <Download className="mr-1.5 h-3 w-3" />
                                        Export
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                    <DropdownMenuItem onClick={() => handleExport("csv")} className="text-xs cursor-pointer">
                                        <FileText className="mr-2 h-3 w-3" />
                                        Export as CSV
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleExport("json")} className="text-xs cursor-pointer">
                                        <FileJson className="mr-2 h-3 w-3" />
                                        Export as JSON
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs text-muted-foreground shadow-none dark:shadow-xs"
                                        onClick={() => setTeamUpgradeOpen(true)}
                                    >
                                        <LockKeyhole className="mr-1.5 h-3 w-3" />
                                        Export
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" sideOffset={8}>Upgrade to Team</TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                </div>

                {isLoading && logs.length === 0 ? (
                    <AuditLogTableSkeleton />
                ) : isError ? (
                    <div className="text-center py-16">
                        <p className="text-sm font-medium">Audit events unavailable</p>
                        <p className="text-xs text-muted-foreground mt-1">Cencori could not load the organization event stream.</p>
                        <Button variant="outline" size="sm" className="mt-4 h-7 text-xs" onClick={() => void refetch()}>
                            Try again
                        </Button>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-16 flex flex-col items-center justify-center">
                        <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center mb-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium mb-1">No events found</p>
                        <p className="text-xs text-muted-foreground">
                            {hasActiveFilters
                                ? "No events match these filters — try clearing them."
                                : "Administrative changes will show up here as they happen."}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="bg-card border border-border/40 rounded-md overflow-hidden">
                            {/* Desktop Table */}
                            <div className="hidden md:block overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent border-b border-border/40">
                                            <TableHead className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider h-8 px-3 w-[180px]">Timestamp</TableHead>
                                            <TableHead className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider h-8 w-[110px]">Category</TableHead>
                                            <TableHead className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider h-8 w-[110px]">Action</TableHead>
                                            <TableHead className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider h-8">Event</TableHead>
                                            <TableHead className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider h-8 w-[200px]">Actor</TableHead>
                                            <TableHead className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider h-8 text-right pr-3 w-[140px]">Scope</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {logs.map((log) => (
                                            <TableRow
                                                key={log.id}
                                                className="cursor-pointer hover:bg-muted/50 border-b border-border/40 last:border-b-0 transition-colors"
                                                onClick={() => setSelectedEventId(log.id)}
                                            >
                                                <TableCell className="py-2 px-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                                                    {formatLogTimestamp(log.created_at)}
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    <span className={cn("inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-mono font-medium lowercase", categoryBadge(log.category))}>
                                                        {categoryLabel(log.category)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
                                                    {log.action.replaceAll("_", " ")}
                                                </TableCell>
                                                <TableCell className="py-2 text-xs max-w-0 w-full">
                                                    <p className="truncate">{log.description}</p>
                                                </TableCell>
                                                <TableCell className="py-2 text-xs text-muted-foreground">
                                                    <p className="max-w-[190px] truncate">{actorLabel(log)}</p>
                                                </TableCell>
                                                <TableCell className="py-2 text-right text-xs text-muted-foreground pr-3">
                                                    <p className="max-w-[130px] ml-auto truncate">{scopeLabel(log)}</p>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile view */}
                            <div className="md:hidden divide-y divide-border/40">
                                {logs.map((log) => (
                                    <div
                                        key={log.id}
                                        className="p-3 cursor-pointer hover:bg-secondary/30 active:bg-secondary/50 transition-colors"
                                        onClick={() => setSelectedEventId(log.id)}
                                    >
                                        <div className="flex items-start justify-between mb-1.5">
                                            <span className={cn("inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-mono font-medium lowercase", categoryBadge(log.category))}>
                                                {categoryLabel(log.category)}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {formatLogTimestamp(log.created_at)}
                                            </span>
                                        </div>
                                        <p className="text-xs truncate mb-1.5">{log.description}</p>
                                        <div className="flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
                                            <span className="truncate">{actorLabel(log)}</span>
                                            <span className="shrink-0">{scopeLabel(log)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between py-3">
                            <p className="text-xs text-muted-foreground">
                                Page {page} of {totalPages}
                                {totalEvents > 0 && <span className="ml-2">· {totalEvents.toLocaleString()} events</span>}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    disabled={page <= 1 || isFetching}
                                    onClick={() => {
                                        setPage((currentPage) => Math.max(1, currentPage - 1));
                                        setSelectedEventId(null);
                                    }}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    disabled={page >= totalPages || isFetching}
                                    onClick={() => {
                                        setPage((currentPage) => Math.min(totalPages, currentPage + 1));
                                        setSelectedEventId(null);
                                    }}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <Dialog
                open={!!selectedEvent}
                onOpenChange={(open) => {
                    if (!open) setSelectedEventId(null);
                }}
            >
                <DialogContent className="sm:max-w-[540px] p-0 top-[10%] translate-y-0 max-h-[80vh] overflow-hidden flex flex-col">
                    {selectedEvent && (
                        <>
                            {/* Header */}
                            <DialogHeader className="px-4 pt-4 pb-3 border-b border-border/40 shrink-0">
                                <DialogTitle className="flex items-center gap-2 text-sm font-medium">
                                    Event Details
                                    <span className={cn("inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-mono font-medium lowercase", categoryBadge(selectedEvent.category))}>
                                        {categoryLabel(selectedEvent.category)}
                                    </span>
                                </DialogTitle>
                                <DialogDescription className="text-[11px] text-muted-foreground">
                                    {formatLogTimestamp(selectedEvent.created_at)} • {selectedEvent.action.replaceAll("_", " ")}
                                </DialogDescription>
                            </DialogHeader>

                            {/* Scrollable content */}
                            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                                <div>
                                    <h3 className="text-xs font-medium mb-2">Event</h3>
                                    <div className="rounded-md border border-border/40 p-3">
                                        <p className="text-xs leading-5">{selectedEvent.description}</p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xs font-medium mb-2">Details</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <ModalDetail label="Actor" value={actorLabel(selectedEvent)} />
                                        <ModalDetail label="Actor type" value={selectedEvent.actor_type} mono />
                                        <ModalDetail label="Scope" value={scopeLabel(selectedEvent)} />
                                        <ModalDetail label="Source IP" value={selectedEvent.actor_ip || "Not recorded"} mono />
                                        <ModalDetail
                                            label="Resource"
                                            value={`${selectedEvent.resource_type}${selectedEvent.resource_id ? ` / ${selectedEvent.resource_id}` : ""}`}
                                            mono
                                            wide
                                        />
                                        <ModalDetail label="Event ID" value={selectedEvent.id} mono wide />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-medium">Metadata</h4>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            aria-label="Copy metadata"
                                            onClick={() => void handleCopyMetadata(selectedEvent)}
                                        >
                                            {metadataCopied ? (
                                                <Check className="h-3 w-3 text-emerald-500" />
                                            ) : (
                                                <Copy className="h-3 w-3" />
                                            )}
                                        </Button>
                                    </div>
                                    {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 ? (
                                        <pre className="rounded-md bg-secondary/50 p-3 text-[11px] font-mono whitespace-pre-wrap break-words max-h-[280px] overflow-y-auto">
                                            {JSON.stringify(selectedEvent.metadata, null, 2)}
                                        </pre>
                                    ) : (
                                        <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                                            No metadata recorded for this event.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <UpgradeDialog
                open={teamUpgradeOpen}
                onOpenChange={setTeamUpgradeOpen}
                orgId={organizationContext.id}
                orgSlug={orgSlug}
                orgName={organizationContext.name}
                currentTier={effectiveTier === "pro" || effectiveTier === "team" ? effectiveTier : "free"}
                reason="Extended audit history, identity events, and ledger exports require Team or Enterprise."
                recommendedTier="team"
                checkoutMode="direct"
                returnPath={`/${orgSlug}/~/audit-log`}
            />
        </div>
    );
}

function LockedSelectOption({
    label,
    requiredTier = "Team",
}: {
    label: string;
    requiredTier?: "Team" | "Enterprise";
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div
                    role="option"
                    aria-disabled="true"
                    aria-selected="false"
                    tabIndex={0}
                    className="flex w-full cursor-not-allowed items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground/45 outline-none transition-colors focus:bg-accent/40"
                >
                    <LockKeyhole className="size-3 shrink-0" />
                    <span>{label}</span>
                </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8} className="text-[10px]">
                {requiredTier === "Enterprise" ? "Enterprise plan required" : "Upgrade to Team"}
            </TooltipContent>
        </Tooltip>
    );
}

function ModalDetail({
    label,
    value,
    mono = false,
    wide = false,
}: {
    label: string;
    value: string;
    mono?: boolean;
    wide?: boolean;
}) {
    return (
        <div className={cn("rounded-md border border-border/40 p-2.5 min-w-0", wide && "col-span-2")}>
            <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
            <p className={cn("text-xs break-all", mono && "font-mono")}>{value}</p>
        </div>
    );
}
