import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/** A category of integrations — "FinOps ›" — and its cards, three to a row. */
export function IntegrationGroup({ label, children }: { label: string; children: ReactNode }) {
    return (
        <section aria-label={label} className="space-y-3">
            <h2 className="flex items-center gap-1 text-sm font-medium">
                {label}
                <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
        </section>
    );
}
