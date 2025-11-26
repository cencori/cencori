import { CodeBlock as AICodeBlock, CodeBlockCopyButton } from "@/components/ai-elements/code-block";
import { type BundledLanguage } from "shiki";

interface CodeBlockProps {
    code: string;
    language?: string;
    filename?: string;
}

export async function CodeBlock({ code, language = "typescript", filename }: CodeBlockProps) {
    return (
        <div className="my-8 not-prose">
            {filename && (
                <div className="bg-muted/40 border-b border-border/40 px-4 py-2 text-xs font-medium text-muted-foreground rounded-t-md">
                    {filename}
                </div>
            )}
            <AICodeBlock
                code={code}
                language={language as BundledLanguage}
                className="rounded-none border-border/40"
            >
                <CodeBlockCopyButton />
            </AICodeBlock>
        </div>
    );
}
