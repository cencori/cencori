import { CodeBlock, CodeBlockCopyButton } from "@/components/ai-elements/code-block";
import { cn } from "@/lib/utils";
import React, { HTMLAttributes, isValidElement } from "react";
import { type BundledLanguage } from "shiki";

export const MDXComponents = {
    h1: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
        <h1
            className={cn(
                "mt-2 scroll-m-20 text-4xl font-bold tracking-tight",
                className
            )}
            {...props}
        />
    ),
    h2: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
        <h2
            className={cn(
                "mt-10 scroll-m-20 border-b pb-1 text-3xl font-semibold tracking-tight first:mt-0",
                className
            )}
            {...props}
        />
    ),
    h3: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
        <h3
            className={cn(
                "mt-8 scroll-m-20 text-2xl font-semibold tracking-tight",
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
            className={cn("leading-7 [&:not(:first-child)]:mt-6 text-muted-foreground", className)}
            {...props}
        />
    ),
    ul: ({ className, ...props }: HTMLAttributes<HTMLUListElement>) => (
        <ul className={cn("my-6 ml-6 list-disc", className)} {...props} />
    ),
    ol: ({ className, ...props }: HTMLAttributes<HTMLOListElement>) => (
        <ol className={cn("my-6 ml-6 list-decimal", className)} {...props} />
    ),
    li: ({ className, ...props }: HTMLAttributes<HTMLLIElement>) => (
        <li className={cn("mt-2", className)} {...props} />
    ),
    blockquote: ({ className, ...props }: HTMLAttributes<HTMLQuoteElement>) => (
        <blockquote
            className={cn(
                "mt-6 border-l-2 pl-6 italic text-muted-foreground",
                className
            )}
            {...props}
        />
    ),
    a: ({ className, ...props }: HTMLAttributes<HTMLAnchorElement>) => (
        <a
            className={cn("font-medium underline underline-offset-4 text-primary hover:text-primary/80 transition-colors", className)}
            {...props}
        />
    ),
    pre: ({ children, className, ...props }: HTMLAttributes<HTMLPreElement>) => {
        // Check if the child is a code element
        if (isValidElement(children) && children.type === 'code') {
            const codeProps = children.props as { className?: string; children?: React.ReactNode };
            const languageClass = codeProps.className || "";
            const language = (languageClass.replace("language-", "") || "typescript") as BundledLanguage;

            // Extract text content from children (handles both string and React nodes)
            const extractText = (node: React.ReactNode): string => {
                if (typeof node === 'string') return node;
                if (Array.isArray(node)) return node.map(extractText).join('');
                if (isValidElement(node)) {
                    const nodeProps = node.props as { children?: React.ReactNode };
                    if (nodeProps.children) {
                        return extractText(nodeProps.children);
                    }
                }
                return '';
            };

            const code = extractText(codeProps.children);

            // If we have code, render CodeBlock
            if (code) {
                return (
                    <div className="my-6">
                        <CodeBlock
                            code={code.trim()}
                            language={language}
                            className="border-zinc-800"
                        >
                            <CodeBlockCopyButton />
                        </CodeBlock>
                    </div>
                );
            }
        }

        // Fallback for non-code block pre tags
        return (
            <pre
                className={cn(
                    "mb-4 mt-6 overflow-x-auto rounded-lg border bg-black py-4",
                    className
                )}
                {...props}
            >
                {children}
            </pre>
        );
    },
    code: ({ className, ...props }: HTMLAttributes<HTMLElement>) => (
        <code
            className={cn(
                "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
                className
            )}
            {...props}
        />
    ),
};
