import { cn } from "@/lib/utils";
import { HTMLAttributes, ComponentProps } from "react";
import Link from "next/link";
import { CodeBlock, Pre } from "@/components/codeblock";

// Docs-specific MDX components with styling matching the blog
export const DocsMDXComponents = {
    h1: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
        <h1
            className={cn(
                "mt-2 scroll-m-20 text-3xl font-bold tracking-tight",
                className
            )}
            {...props}
        />
    ),
    h2: ({ className, id, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
        <h2
            id={id}
            className={cn(
                "mt-8 scroll-m-20 border-b border-border/40 pb-1 text-2xl font-semibold tracking-tight first:mt-0",
                className
            )}
            {...props}
        />
    ),
    h3: ({ className, id, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
        <h3
            id={id}
            className={cn(
                "mt-6 scroll-m-20 text-xl font-semibold tracking-tight",
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
            className={cn("leading-7 [&:not(:first-child)]:mt-4 text-muted-foreground", className)}
            {...props}
        />
    ),
    ul: ({ className, ...props }: HTMLAttributes<HTMLUListElement>) => (
        <ul className={cn("my-3 ml-6 list-disc [&>li]:mt-1 text-muted-foreground", className)} {...props} />
    ),
    ol: ({ className, ...props }: HTMLAttributes<HTMLOListElement>) => (
        <ol className={cn("my-3 ml-6 list-decimal [&>li]:mt-1 text-muted-foreground", className)} {...props} />
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
    pre: ({ ref: _ref, ...props }: ComponentProps<'pre'>) => (
        <CodeBlock className="not-prose my-4">
            <Pre>{props.children}</Pre>
        </CodeBlock>
    ),
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
        <div className="my-4 w-full overflow-x-auto">
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
            className={cn("border-b border-border/50", className)}
            {...props}
        />
    ),
    th: ({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) => (
        <th
            className={cn(
                "px-4 py-2 text-left font-semibold text-foreground",
                className
            )}
            {...props}
        />
    ),
    td: ({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) => (
        <td
            className={cn("px-4 py-2 text-muted-foreground", className)}
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
