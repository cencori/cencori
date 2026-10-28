import { HugeiconsIcon } from "@hugeicons/react";
import Loading03Icon from "@hugeicons/core-free-icons/Loading03Icon";
import { cn } from "@/lib/utils";

/** Cencori's spinner, everywhere something is loading. Size and colour come from className (h-4 w-4, text-muted-foreground). */
export function Spinner({ className }: { className?: string }) {
    return <HugeiconsIcon icon={Loading03Icon} aria-hidden="true" className={cn("h-4 w-4 shrink-0 animate-spin", className)} />;
}
