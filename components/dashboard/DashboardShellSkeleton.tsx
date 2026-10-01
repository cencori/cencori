import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SIDEBAR_ROWS = [92, 78, 85, 70, 88, 74, 82, 68, 80, 76] as const;

/**
 * Instant, data-free dashboard chrome.
 *
 * Rendered whenever the real shell can't mount yet (auth resolving without a
 * cached user, console workspace bootstrap). The previous behavior returned
 * `null` in these windows, which reads as a broken dark void with no sidebar.
 * A skeleton keeps navigation feeling snappy and never leaves a bare screen.
 */
export function DashboardShellSkeleton({
  className,
  children,
}: {
  className?: string;
  /** Replaces the content skeletons — e.g. an error card that keeps the chrome. */
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn("dashboard-theme bg-background font-inter", className)}
      role="status"
      aria-label="Loading dashboard"
    >
      <div className="flex min-h-svh">
        {/* Desktop sidebar placeholder — in normal flow so content never jumps. */}
        <div className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border/70 bg-sidebar lg:flex">
          <div className="flex h-12 shrink-0 items-center px-3">
            <Skeleton className="h-6 w-full rounded-md" />
          </div>
          <div className="px-2 pt-3">
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
          <div className="flex-1 space-y-1 px-2 py-3">
            {SIDEBAR_ROWS.map((width, index) => (
              <Skeleton
                key={index}
                className="h-8 rounded-md"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
          <div className="space-y-1 p-2">
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {/* Fixed header placeholder (mirrors the real h-12 dashboard header). */}
          <div className="fixed inset-x-0 top-0 z-50 flex h-12 items-center justify-end gap-2 border-b border-border/30 bg-background px-4 md:px-6 lg:left-64">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full lg:hidden" />
            <Skeleton className="hidden h-6 w-24 rounded-full lg:block" />
          </div>

          <main className="p-4 pt-20 md:p-6 lg:pt-14">
            {children ?? (
              <div className="mx-auto w-full max-w-[1360px]">
                <div className="mb-8 space-y-2">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-3 w-72 max-w-full" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Skeleton className="h-36 rounded-xl" />
                  <Skeleton className="h-36 rounded-xl" />
                </div>
                <Skeleton className="mt-4 h-64 rounded-xl" />
                <span className="sr-only">Loading the dashboard</span>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
