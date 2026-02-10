import { cn } from "@/lib/utils";
import { HTMLAttributes, ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { CodeBlock } from "@/components/codeblock";
import { Check, X, AlertTriangle, Globe, Database, Brain, Zap, Flame, Layout, Server, Shield } from "lucide-react";

// Icon mapping for MDX string props
const Icons: Record<string, any> = {
    Globe, Database, Brain, Zap, Flame, Layout, Server, Shield
};

function Card({ href, title, icon, children, className }: { href?: string; title: string; icon?: string; children?: ReactNode; className?: string }) {
    const Icon = icon ? Icons[icon] : null;
    const isExternal = href && (href.startsWith('http') || href.startsWith('https'));

    const content = (
        <div className={cn("group relative rounded-lg border border-border/60 p-6 transition-all hover:bg-muted/30", href && "hover:border-purple-500/40 hover:shadow-sm", className)}>
            <div className="flex items-start gap-4">
                {Icon && (
                    <div className="shrink-0 rounded-md bg-muted p-2 text-purple-500">
                        <Icon className="h-6 w-6" />
                    </div>
                )}
                <div className="space-y-2">
                    <h3 className="font-semibold leading-none tracking-tight">{title}</h3>
                    <div className="text-sm text-muted-foreground">{children}</div>
                </div>
            </div>
        </div>
    );

    if (href) {
        return (
            <Link href={href} className="block no-underline" target={isExternal ? "_blank" : undefined}>
                {content}
            </Link>
        );
    }

    return content;
}

function CardGroup({ children, cols = 2, className }: { children: ReactNode; cols?: number; className?: string }) {
    return (
        <div className={cn("grid gap-4 my-6", cols === 1 && "grid-cols-1", cols === 2 && "grid-cols-1 md:grid-cols-2", cols === 3 && "grid-cols-1 md:grid-cols-3", className)}>
            {children}
        </div>
    );
}

// Docs-specific MDX components with styling matching the blog
export const DocsMDXComponents = {
    // ... existing components ...
    h1: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
        <h1
            className={cn(
                "mt-2 scroll-m-20 text-4xl font-bold tracking-tight",
                className
            )}
            {...props}
        />
    ),
    h2: ({ className, id, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
        <h2
            id={id}
            className={cn(
                "mt-10 scroll-m-20 text-2xl font-semibold tracking-tight first:mt-0",
                className
            )}
            {...props}
        />
    ),
    h3: ({ className, id, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
        <h3
            id={id}
            className={cn(
                "mt-8 scroll-m-20 text-xl font-semibold tracking-tight",
                className
            )}
            {...props}
        />
    ),
    h4: ({ className, id, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
        <h4
            id={id}
            className={cn(
                "mt-4 scroll-m-20 text-lg font-semibold tracking-tight",
                className
            )}
            {...props}
        />
    ),
    p: ({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) => (
        <p
            className={cn("leading-7 [&:not(:first-child)]:mt-4 text-[0.95rem] text-foreground", className)}
            {...props}
        />
    ),
    ul: ({ className, ...props }: HTMLAttributes<HTMLUListElement>) => (
        <ul className={cn("my-3 ml-5 list-disc [&>li]:mt-1 text-[0.95rem] text-foreground", className)} {...props} />
    ),
    ol: ({ className, ...props }: HTMLAttributes<HTMLOListElement>) => (
        <ol className={cn("my-3 ml-5 list-decimal [&>li]:mt-1 text-[0.95rem] text-foreground", className)} {...props} />
    ),
    li: ({ className, ...props }: HTMLAttributes<HTMLLIElement>) => (
        <li className={cn("leading-7", className)} {...props} />
    ),
    blockquote: ({ className, ...props }: HTMLAttributes<HTMLQuoteElement>) => (
        <blockquote
            className={cn(
                "my-4 border-l-4 border-primary/40 pl-4 py-1 italic text-muted-foreground",
                className
            )}
            {...props}
        />
    ),
    a: ({ className, href, children, ...props }: HTMLAttributes<HTMLAnchorElement> & { href?: string }) => {
        const isExternal = href && (href.startsWith('http://') || href.startsWith('https://'));

        if (isExternal) {
            return (
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn("font-medium text-primary underline underline-offset-4 hover:no-underline", className)}
                    {...props}
                >
                    {children}
                </a>
            );
        }

        if (href) {
            return (
                <Link
                    href={href}
                    className={cn("font-medium text-primary underline underline-offset-4 hover:no-underline", className)}
                    {...props}
                >
                    {children}
                </Link>
            );
        }

        return (
            <a
                className={cn("font-medium text-primary underline underline-offset-4 hover:no-underline", className)}
                {...props}
            >
                {children}
            </a>
        );
    },
    pre: ({ ref: _ref, ...props }: ComponentProps<'pre'>) => {
        const codeElement = props.children as { props?: { className?: string; children?: unknown } };
        const className = codeElement?.props?.className ?? '';
        const code = codeElement?.props?.children ?? props.children;
        return (
            <div className="not-prose my-4">
                <CodeBlock className={className}>{code as ReactNode}</CodeBlock>
            </div>
        );
    },
    code: ({ className, ...props }: HTMLAttributes<HTMLElement>) => (
        <code
            className={cn(
                "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm",
                className
            )}
            {...props}
        />
    ),
    table: ({ className, ...props }: HTMLAttributes<HTMLTableElement>) => (
        <div className="my-5 w-full overflow-x-auto rounded-md border border-border/40">
            <table
                className={cn("w-full text-sm", className)}
                {...props}
            />
        </div>
    ),
    thead: ({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) => (
        <thead className={cn("", className)} {...props} />
    ),
    tbody: ({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) => (
        <tbody className={cn("", className)} {...props} />
    ),
    tr: ({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) => (
        <tr
            className={cn("border-b border-border/50 transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className)}
            {...props}
        />
    ),
    th: ({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) => (
        <th
            className={cn(
                "border-r border-border/40 px-4 py-2 text-left font-semibold [&[align=center]]:text-center [&[align=right]]:text-right bg-muted/40 last:border-r-0",
                className
            )}
            {...props}
        />
    ),
    td: ({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) => (
        <td
            className={cn("border-r border-border/40 px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right last:border-r-0", className)}
            {...props}
        />
    ),
    hr: ({ className, ...props }: HTMLAttributes<HTMLHRElement>) => (
        <hr className={cn("my-6 border-border/40", className)} {...props} />
    ),
    strong: ({ className, ...props }: HTMLAttributes<HTMLElement>) => (
        <strong className={cn("font-semibold text-foreground", className)} {...props} />
    ),
    Check: ({ className, ...props }: ComponentProps<typeof Check>) => (
        <Check className={cn("w-4 h-4 text-green-500 inline-block align-middle", className)} {...props} />
    ),
    X: ({ className, ...props }: ComponentProps<typeof X>) => (
        <X className={cn("w-4 h-4 text-red-500 inline-block align-middle", className)} {...props} />
    ),
    AlertTriangle: ({ className, ...props }: ComponentProps<typeof AlertTriangle>) => (
        <AlertTriangle className={cn("w-4 h-4 text-amber-500 inline-block align-middle", className)} {...props} />
    ),
    Card,
    Cards: CardGroup,
    CardGroup,
};
