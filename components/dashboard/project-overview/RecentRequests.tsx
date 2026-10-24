"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import LeftToRightListDashIcon from "@hugeicons/core-free-icons/LeftToRightListDashIcon";
import { StatusBadge } from "@/components/audit/StatusBadge";
import { RequestDetailModal } from "@/components/audit/RequestDetailModal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const RECENT_REQUEST_LIMIT = 5;

export interface RecentRequest {
  id: string;
  created_at: string;
  status: "success" | "success_fallback" | "filtered" | "blocked_output" | "error" | "rate_limited";
  model: string;
  total_tokens: number;
  cost_usd: number;
  latency_ms: number;
}

// Same "02 Jan 26 17:41:47" timestamp as the Logs table.
function formatDate(dateString: string) {
  const date = new Date(dateString);
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

/**
 * The newest requests for the overview. Lives beside the usage query so the
 * page can swap both in together when the period changes.
 * timeRange takes the period picker's values: 1h | 24h | 7d | 30d | all.
 */
export function useRecentRequests(projectId: string | undefined, timeRange: string) {
  return useQuery<{ requests: RecentRequest[] }>({
    queryKey: ["recent-requests", projectId, timeRange],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        page: "1",
        per_page: String(RECENT_REQUEST_LIMIT),
        time_range: timeRange,
        count: "none",
      });
      const response = await fetch(`/api/projects/${projectId}/logs?${params}`, { signal });
      if (!response.ok) throw new Error("Failed to fetch recent requests");
      return response.json();
    },
    enabled: Boolean(projectId),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    placeholderData: (previousData) => previousData,
  });
}

/** A five-row summary of the Logs table for the project overview. */
export function RecentRequests({
  projectId,
  logsHref,
  requests: allRequests,
  loading,
  error,
}: {
  projectId?: string;
  logsHref: string;
  requests: RecentRequest[];
  loading: boolean;
  error: boolean;
}) {
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const requests = allRequests.slice(0, RECENT_REQUEST_LIMIT);

  return (
    <section className="mt-8" aria-labelledby="recent-requests-heading">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="recent-requests-heading" className="text-sm font-medium tracking-[-0.02em]">
          Requests
        </h2>
        <Button asChild size="sm" className="h-7 text-xs">
          <Link href={logsHref}>View logs</Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border/40 bg-muted/30">

      {loading ? (
        <div className="divide-y divide-border/40">
          {Array.from({ length: RECENT_REQUEST_LIMIT }).map((_, index) => (
            <div key={index} className="grid grid-cols-6 items-center gap-4 px-4 py-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-5 w-10" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="ml-auto h-3 w-12" />
              <Skeleton className="ml-auto h-3 w-16" />
              <Skeleton className="ml-auto h-3 w-12" />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="px-5 py-8 text-center text-xs text-muted-foreground">
          Recent requests couldn&apos;t be loaded.
        </p>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-secondary">
            <HugeiconsIcon icon={LeftToRightListDashIcon} className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mb-1 text-sm font-medium">No requests found</p>
          <p className="text-xs text-muted-foreground">No requests in this period.</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/40 hover:bg-transparent">
                  <TableHead className="h-8 w-[180px] px-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Timestamp</TableHead>
                  <TableHead className="h-8 w-[60px] text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="h-8 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Model</TableHead>
                  <TableHead className="h-8 w-[80px] text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Tokens</TableHead>
                  <TableHead className="h-8 w-[100px] text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Cost</TableHead>
                  <TableHead className="h-8 w-[80px] pr-3 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Latency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow
                    key={request.id}
                    className="cursor-pointer border-b border-border/40 transition-colors last:border-b-0 hover:bg-muted/50"
                    onClick={() => setSelectedRequest(request.id)}
                  >
                    <TableCell className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">
                      {formatDate(request.created_at)}
                    </TableCell>
                    <TableCell className="py-2">
                      <StatusBadge status={request.status} variant="code" />
                    </TableCell>
                    <TableCell className="py-2 font-mono text-xs text-muted-foreground">{request.model}</TableCell>
                    <TableCell className="py-2 text-right font-mono text-xs text-muted-foreground">
                      {request.total_tokens.toLocaleString()}
                    </TableCell>
                    <TableCell className="py-2 text-right font-mono text-xs text-muted-foreground">
                      ${request.cost_usd.toFixed(6)}
                    </TableCell>
                    <TableCell className="py-2 pr-3 text-right font-mono text-xs text-muted-foreground">
                      {request.latency_ms}ms
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="divide-y divide-border/40 md:hidden">
            {requests.map((request) => (
              <button
                key={request.id}
                type="button"
                className="w-full p-3 text-left transition-colors hover:bg-secondary/30 active:bg-secondary/50"
                onClick={() => setSelectedRequest(request.id)}
              >
                <div className="mb-1.5 flex items-start justify-between">
                  <StatusBadge status={request.status} variant="code" />
                  <span className="text-[10px] text-muted-foreground">{formatDate(request.created_at)}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="font-mono">{request.model}</span>
                  <span className="font-mono">{request.latency_ms}ms</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
      </div>

      {projectId && selectedRequest && (
        <RequestDetailModal
          projectId={projectId}
          requestId={selectedRequest}
          open={Boolean(selectedRequest)}
          onOpenChange={(open) => {
            if (!open) setSelectedRequest(null);
          }}
        />
      )}
    </section>
  );
}
