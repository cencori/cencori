import { CodeBlock, Pre } from "@/components/codeblock";
import { cn } from "@/lib/utils";
import { HTMLAttributes, ComponentProps } from "react";
import { Callout } from "@/components/blog/Callout";
import { Card, Cards } from "@/components/blog/Cards";
import { SecurityArchitectureDiagram } from "@/components/blog/SecurityArchitectureDiagram";
import Link from "next/link";

export const MDXComponents = {
    h1: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
        <h1
            className={cn(
                "mt-2 scroll-m-20 text-4xl md:text-5xl font-bold tracking-tight leading-tight",
                className
            )}
            {...props}
        />
    ),
    h2: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
        <h2
            className={cn(
                "mt-16 scroll-m-20 border-b border-border/40 pb-3 text-3xl md:text-4xl font-bold tracking-tight first:mt-0",
                className
            )}
            {...props}
        />
    ),
    h3: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
        <h3
            className={cn(
                "mt-12 scroll-m-20 text-2xl md:text-3xl font-semibold tracking-tight",
                className
            )}
            {...props}
        />
    ),
    h4: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
        <h4
            className={cn(
                "mt-8 scroll-m-20 text-xl font-semibold tracking-tight",
                className
            )}
            {...props}
        />
    ),
    p: ({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) => (
        <p
            className={cn("leading-8 text-[16px] [&:not(:first-child)]:mt-6 text-foreground/80", className)}
            {...props}
        />
    ),
    ul: ({ className, ...props }: HTMLAttributes<HTMLUListElement>) => (
        <ul className={cn("my-8 ml-6 list-disc space-y-3 text-foreground/80", className)} {...props} />
    ),
    ol: ({ className, ...props }: HTMLAttributes<HTMLOListElement>) => (
        <ol className={cn("my-8 ml-6 list-decimal space-y-3 text-foreground/80", className)} {...props} />
    ),
    li: ({ className, ...props }: HTMLAttributes<HTMLLIElement>) => (
        <li className={cn("leading-7 text-[16px]", className)} {...props} />
    ),
    blockquote: ({ className, ...props }: HTMLAttributes<HTMLQuoteElement>) => (
        <blockquote
            className={cn(
                "my-8 border-l-4 border-purple-500/40 pl-6 py-2 italic text-foreground/70 bg-muted/30 rounded-r-lg",
                className
            )}
            {...props}
        />
    ),
    a: ({ className, href, children, ...props }: HTMLAttributes<HTMLAnchorElement> & { href?: string }) => {
        // Check if link is external
        const isExternal = href && (href.startsWith('http://') || href.startsWith('https://'));

        if (isExternal) {
            return (
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn("font-medium text-blue-400 no-underline hover:underline underline-offset-4 transition-colors", className)}
                    {...props}
                >
                    {children}
                </a>
            );
        }

        // Internal link using Next.js Link
        if (href) {
            return (
                <Link
                    href={href}
                    className={cn("font-medium text-blue-400 no-underline hover:underline underline-offset-4 transition-colors", className)}
                    {...props}
                >
                    {children}
                </Link>
            );
        }

        // Fallback for links without href
        return (
            <a
                className={cn("font-medium text-blue-400 no-underline hover:underline underline-offset-4 transition-colors", className)}
                {...props}
            >
                {children}
            </a>
        );
    },
    pre: ({ ref: _ref, ...props }: ComponentProps<'pre'>) => (
        <CodeBlock className="not-prose">
            <Pre>{props.children}</Pre>
        </CodeBlock>
    ),
    code: ({ className, ...props }: HTMLAttributes<HTMLElement>) => (
        <code
            className={cn(
                "font-mono text-[0.85em] font-medium text-blue-300",
                className
            )}
            {...props}
        />
    ),
    // Table components
    table: ({ className, ...props }: HTMLAttributes<HTMLTableElement>) => (
        <div className="my-8 w-full overflow-x-auto">
            <table
                className={cn(
                    "w-full border-collapse text-sm",
                    className
                )}
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
            className={cn(
                "border-b border-border/50 transition-colors",
                className
            )}
            {...props}
        />
    ),
    th: ({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) => (
        <th
            className={cn(
                "px-4 py-3 text-left font-semibold text-foreground/90 border-b border-border/70 bg-muted/20",
                className
            )}
            {...props}
        />
    ),
    td: ({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) => (
        <td
            className={cn(
                "px-4 py-3 text-foreground/80 align-top",
                className
            )}
            {...props}
        />
    ),
    // Horizontal rule - short centered separator
    hr: ({ className, ...props }: HTMLAttributes<HTMLHRElement>) => (
        <div className={cn("my-10 flex justify-center", className)} {...props}>
            <span className="w-12 h-px bg-border/60" />
        </div>
    ),
    // Strong/bold text
    strong: ({ className, ...props }: HTMLAttributes<HTMLElement>) => (
        <strong className={cn("font-semibold text-foreground", className)} {...props} />
    ),
    Callout,
    Card,
    Cards,
    SecurityArchitectureDiagram,
};

