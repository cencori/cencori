import { cn } from "@/lib/utils";
import { HTMLAttributes, ComponentProps } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { CodeBlock } from "@/components/codeblock";

// Docs-specific MDX components with styling matching the blog
export const DocsMDXComponents = {
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
            className={cn("leading-7 [&:not(:first-child)]:mt-4 text-[0.95rem] text-muted-foreground", className)}
            {...props}
        />
    ),
    ul: ({ className, ...props }: HTMLAttributes<HTMLUListElement>) => (
        <ul className={cn("my-3 ml-5 list-disc [&>li]:mt-1 text-[0.95rem] text-muted-foreground", className)} {...props} />
    ),
    ol: ({ className, ...props }: HTMLAttributes<HTMLOListElement>) => (
        <ol className={cn("my-3 ml-5 list-decimal [&>li]:mt-1 text-[0.95rem] text-muted-foreground", className)} {...props} />
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
};
