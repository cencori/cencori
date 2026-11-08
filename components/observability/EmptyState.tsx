import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';

export interface OtherSource {
    href: string;
    icon: IconSvgElement;
    label: string;
    description: string;
}

/**
 * An empty Observability list: centred in the space left, with a way to the
 * other data sources (as Vercel's Logs does), since the answer is often there.
 */
export function ObservabilityEmptyState({
    icon, title, description, otherSources = [],
}: {
    icon: IconSvgElement;
    title: string;
    description: string;
    otherSources?: OtherSource[];
}) {
    return (
        <div className="flex min-h-[calc(100%-2.25rem)] items-center justify-center px-4 py-16">
            <div className="flex w-full max-w-sm flex-col items-center text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-border/60">
                    <HugeiconsIcon icon={icon} className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">{title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>

                {otherSources.length > 0 && (
                    <div className="mt-8 w-full">
                        <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="h-px flex-1 bg-border/60" />
                            Other data sources
                            <span className="h-px flex-1 bg-border/60" />
                        </div>
                        <div className="space-y-2">
                            {otherSources.map((s) => (
                                <Link
                                    key={s.href}
                                    href={s.href}
                                    className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                                >
                                    <HugeiconsIcon icon={s.icon} className="h-4 w-4 shrink-0" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm">{s.label}</span>
                                        <span className="block text-xs text-muted-foreground">{s.description}</span>
                                    </span>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
