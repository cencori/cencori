"use client";

import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CodeBlock as HighlightedCodeBlock } from "@/components/ai-elements/code-block";
import { Reveal } from "@/components/landing/Reveal";
import { Terminal, Code2, ClipboardCheck, Copy } from "lucide-react";

const steps = [
    {
        number: "01",
        title: "Create your account",
        description: "Go to cencori.com → sign up → grab your API key from Project Settings."
    },
    {
        number: "02",
        title: "Add a provider key",
        description: "Add your OpenAI, Anthropic, or any provider key in the dashboard sidebar."
    },
    {
        number: "03",
        title: "Bootstrap your app",
        description: "Run the CLI to scaffold a full Next.js app, pre-wired to Cencori's infrastructure."
    },
    {
        number: "04",
        title: "Ship",
        description: "npm run dev → localhost:3000 → streaming, live, on Cencori."
    }
];

const cliCode = `# Scaffold a full stack AI app
npx create-cencori-app my-app`;

const sdkCode = `// Gateway — 100+ models, one key
cencori('claude-sonnet-4-5')
cencori('gpt-4o')
cencori('llama-3-70b')

// Memory — persistent context
cencori.memory.store({ userId, content })
cencori.memory.retrieve({ userId, query })

// Billing — monetize AI usage
cencori.billing.meter({ userId, tokens })`;

export const HowToSetup = () => {
    const [activeTab, setActiveTab] = useState<"cli" | "sdk">("cli");
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        const textToCopy = activeTab === "cli" ? cliCode : sdkCode;
        try {
            await navigator.clipboard.writeText(textToCopy);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy", err);
        }
    };

    return (
        <section className="py-24 sm:py-32 bg-background relative overflow-hidden border-t border-border/10">
            <div className="mx-auto max-w-6xl px-4 md:px-6">
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_1fr] gap-16 lg:gap-24 items-start">
                    
                    {/* Left Column: Heading & Steps */}
                    <div>
                        <Reveal>
                            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">
                                Get Started In Minutes
                            </p>
                        </Reveal>
                        <Reveal delay={0.05}>
                            <h2 className="text-3xl sm:text-[2.75rem] font-heading font-black tracking-[-0.03em] leading-[1.05] mb-6 text-foreground">
                                From zero to production in under 3 minutes.
                            </h2>
                        </Reveal>
                        <Reveal delay={0.1}>
                            <p className="max-w-sm text-sm text-muted-foreground leading-[1.7] mb-10">
                                Cencori takes care of the routing, memory, and billing, so you can build and ship the actual product.
                            </p>
                        </Reveal>

                        {/* Setup steps stack */}
                        <div className="space-y-0">
                            {steps.map((step, index) => (
                                <Reveal key={step.number} delay={index * 0.08}>
                                    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4 sm:gap-6">
                                        <div className="flex flex-col items-center">
                                            <div className="flex size-7 items-center justify-center rounded-full border border-border/50 bg-foreground/[0.02] text-[10px] font-mono font-medium text-muted-foreground">
                                                {step.number}
                                            </div>
                                            {index < steps.length - 1 && (
                                                <div className="mt-3 w-px flex-1 min-h-12 bg-border/40" />
                                            )}
                                        </div>

                                        <div className="pb-8">
                                            <h3 className="mb-1 text-sm font-semibold text-foreground">
                                                {step.title}
                                            </h3>
                                            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                                                {step.description}
                                            </p>
                                        </div>
                                    </div>
                                </Reveal>
                            ))}
                        </div>
                    </div>

                    {/* Right Column: Code Panel */}
                    <div className="w-full">
                        <Reveal delay={0.25}>
                            <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden backdrop-blur-sm">
                                
                                {/* Editor Header */}
                                <div className="flex items-center justify-between border-b border-border/40 bg-foreground/[0.02] px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex gap-1.5">
                                            <span className="size-2.5 rounded-full bg-border/80" />
                                            <span className="size-2.5 rounded-full bg-border/80" />
                                            <span className="size-2.5 rounded-full bg-border/80" />
                                        </div>
                                        <div className="h-4 w-px bg-border/30" />
                                        
                                        {/* Tab Selectors */}
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => { setActiveTab("cli"); setCopied(false); }}
                                                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-mono transition-all ${activeTab === "cli" ? "bg-foreground/[0.04] text-foreground font-medium border border-border/45" : "text-muted-foreground hover:text-foreground"}`}
                                            >
                                                <Terminal className="size-3" />
                                                <span>cencori-cli</span>
                                            </button>
                                            <button
                                                onClick={() => { setActiveTab("sdk"); setCopied(false); }}
                                                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-mono transition-all ${activeTab === "sdk" ? "bg-foreground/[0.04] text-foreground font-medium border border-border/45" : "text-muted-foreground hover:text-foreground"}`}
                                            >
                                                <Code2 className="size-3" />
                                                <span>cencori.ts</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Copy Button */}
                                    <button
                                        type="button"
                                        onClick={handleCopy}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border/40 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-all bg-background/50"
                                        aria-label="Copy snippet"
                                    >
                                        {copied ? (
                                            <>
                                                <ClipboardCheck className="size-3 text-emerald-400" />
                                                <span className="text-emerald-400">Copied!</span>
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="size-3" />
                                                <span>Copy</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Code Highlight Blocks */}
                                <div className="p-1">
                                    {activeTab === "cli" ? (
                                        <HighlightedCodeBlock
                                            code={cliCode}
                                            language="bash"
                                            className="rounded-xl border-0"
                                        />
                                    ) : (
                                        <HighlightedCodeBlock
                                            code={sdkCode}
                                            language="typescript"
                                            className="rounded-xl border-0"
                                        />
                                    )}
                                </div>

                            </div>
                        </Reveal>
                    </div>

                </div>
            </div>
        </section>
    );
};
