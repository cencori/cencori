import { cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowUpRight, LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface CardProps {
    href?: string;
    title: string;
    icon?: ReactNode;
    children?: ReactNode;
    className?: string;
    external?: boolean;
}

export function Card({
    href,
    title,
    icon,
    children,
    className,
    external
}: CardProps) {
    const isExternal = external || (href && (href.startsWith('http://') || href.startsWith('https://')));

    const content = (
        <>
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                    {icon && (
                        <div className="text-purple-500 dark:text-purple-400">
                            {icon}
                        </div>
                    )}
                    <h3 className="font-semibold text-lg m-0">{title}</h3>
                </div>
                {href && isExternal && (
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
            </div>
            {children && (
                <div className="text-sm text-muted-foreground mt-2">
                    {children}
                </div>
            )}
        </>
    );

    const cardClasses = cn(
        "group relative rounded-lg border border-border/60 p-5 transition-all",
        href && "hover:border-purple-500/40 hover:bg-muted/30 hover:shadow-md cursor-pointer",
        className
    );

    if (href) {
        if (isExternal) {
            return (
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cardClasses}
                >
                    {content}
                </a>
            );
        }

        return (
            <Link href={href} className={cardClasses}>
                {content}
            </Link>
        );
    }

    return (
        <div className={cardClasses}>
            {content}
        </div>
    );
}

interface CardsProps {
    children: ReactNode;
    className?: string;
    cols?: 1 | 2 | 3;
}

export function Cards({ children, className, cols = 2 }: CardsProps) {
    const gridCols = {
        1: "grid-cols-1",
        2: "grid-cols-1 md:grid-cols-2",
        3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    };

    return (
        <div className={cn(
            "grid gap-4 my-8",
            gridCols[cols],
            className
        )}>
            {children}
        </div>
    );
}
