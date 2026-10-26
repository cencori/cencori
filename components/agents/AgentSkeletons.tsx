import { Skeleton } from "@/components/ui/skeleton";

/** A settings card while it loads: rows shaped like SettingsRow. */
export function SettingsCardSkeleton({ rows = 3 }: { rows?: number }) {
    return (
        <div className="overflow-hidden rounded-lg border border-border/35 bg-muted/30" aria-busy="true" aria-label="Loading">
            {Array.from({ length: rows }, (_, index) => (
                <div key={index} className="flex items-center justify-between gap-6 border-b border-border/30 px-4 py-3.5 last:border-b-0">
                    <div className="min-w-0 flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-2.5 w-2/3 max-w-[420px]" />
                    </div>
                    <Skeleton className="h-7 w-24 shrink-0" />
                </div>
            ))}
        </div>
    );
}

/** The knowledge list while it loads. */
export function KnowledgeSkeleton() {
    return (
        <div aria-busy="true" aria-label="Loading">
            <Skeleton className="mb-4 h-8 w-full" />
            <div className="overflow-hidden rounded-lg border border-border/40">
                {Array.from({ length: 5 }, (_, index) => (
                    <div key={index} className="flex items-center gap-3 border-b border-border/30 px-3 py-3 last:border-b-0">
                        <Skeleton className="h-6 w-6 shrink-0" />
                        <div className="min-w-0 flex-1 space-y-1.5">
                            <Skeleton className="h-3 w-48" />
                            <Skeleton className="h-2.5 w-72 max-w-full" />
                        </div>
                        <Skeleton className="h-3 w-16 shrink-0" />
                    </div>
                ))}
            </div>
        </div>
    );
}

/** The app catalog's tiles while it loads. */
export function AppTilesSkeleton() {
    return (
        <div className="space-y-5" aria-busy="true" aria-label="Loading">
            {[4, 2].map((count, group) => (
                <section key={group}>
                    <Skeleton className="mb-2 h-2.5 w-20" />
                    <div className="grid grid-cols-2 gap-2">
                        {Array.from({ length: count }, (_, index) => (
                            <div key={index} className="flex items-center gap-2.5 rounded-lg border border-border/60 p-3">
                                <Skeleton className="h-8 w-8 shrink-0" />
                                <div className="flex-1 space-y-1.5">
                                    <Skeleton className="h-3 w-24" />
                                    <Skeleton className="h-2.5 w-16" />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

/** The website chat preview while it loads. */
export function WidgetPreviewSkeleton() {
    return (
        <div className="flex h-full flex-col gap-3 p-4" aria-busy="true" aria-label="Loading">
            <div className="flex items-center gap-2.5">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="ml-auto h-9 w-1/2" />
            <Skeleton className="h-16 w-4/5" />
            <div className="flex-1" />
            <Skeleton className="h-10 w-full rounded-full" />
        </div>
    );
}
