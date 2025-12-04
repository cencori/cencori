import Link from "next/link";
import { cn } from "@/lib/utils";

interface TagChipProps {
    tag: string;
    active?: boolean;
    href?: string;
}

export function TagChip({ tag, active = false, href }: TagChipProps) {
    const className = cn(
        "inline-flex items-center px-3 py-1 rounded-full text-sm transition-colors",
        active
            ? "bg-primary text-primary-foreground"
            : "bg-muted hover:bg-muted-foreground/20 text-foreground"
    );

    if (href) {
        return (
            <Link href={href} className={className}>
                {tag}
            </Link>
        );
    }

    return <span className={className}>{tag}</span>;
}
