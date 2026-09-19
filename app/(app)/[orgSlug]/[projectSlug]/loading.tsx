import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectRouteLoading() {
    return (
        <div
            className="mx-auto w-full max-w-[1360px] px-6 py-8"
            role="status"
            aria-label="Loading page"
        >
            <div className="mb-8 space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-3 w-72 max-w-full" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-36 rounded-xl" />
                <Skeleton className="h-36 rounded-xl" />
            </div>

            <Skeleton className="mt-4 h-64 rounded-xl" />
            <span className="sr-only">Loading the selected page</span>
        </div>
    );
}
