import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Comparison | Cencori Docs",
    description: "How Cencori compares to OpenRouter, LiteLLM, Portkey, Helicone, and LangChain.",
};

const competitors = [
    {
        name: "OpenRouter",
        color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
        tagline: "They're a marketplace. We're infrastructure.",
        theyDo: "Aggregator for trying different models. Pay-as-you-go, no commitment.",
        weDo: "Production infrastructure. Bring your own API keys, get observability, security, failover, and cost controls.",
        summary: "OpenRouter is for experimentation; Cencori is for shipping.",
    },
    {
        name: "LiteLLM",
        color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
        tagline: "They're a library. We're a platform.",
        theyDo: "Python library for unified API calls. Self-hosted, configurable.",
        weDo: "Managed platform with dashboard, analytics, security guardrails, and audit logs built-in.",
        summary: "LiteLLM requires you to build all the observability yourself. Cencori gives you that out of the box.",
    },
    {
        name: "Portkey",
        color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
        tagline: "Similar space, different bet.",
        theyDo: "Focused on agent orchestration (MCP) and enterprise.",
        weDo: "Developer-first, simpler, faster to integrate. 2-line SDK.",
        summary: "We're the Stripe of AI infrastructure—make it so easy that you don't think about it. Portkey is heavier-weight.",
    },
    {
        name: "Helicone",
        color: "bg-orange-500/20 text-orange-400 border-orange-500/30",
        tagline: "They're observability. We're observability + control.",
        theyDo: "Logging + analytics (read-only).",
        weDo: "Logging + analytics + security guardrails + failover + rate limiting (read + write).",
        summary: "We don't just show you what happened—we let you control what will happen.",
    },
    {
        name: "LangChain",
        color: "bg-teal-500/20 text-teal-400 border-teal-500/30",
        tagline: "They're a framework. We're infrastructure.",
        theyDo: "Python/JS framework for building AI apps (chains, agents).",
        weDo: "Provider-agnostic infrastructure that works with LangChain OR without it.",
        summary: "LangChain is how you build. Cencori is how you ship safely.",
    },
];

export default function ComparisonPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Cencori vs. Alternatives
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    How Cencori compares to other AI infrastructure solutions. TL;DR: We're the <strong className="text-foreground">Stripe of AI infrastructure</strong>—invisible, reliable, just works.
                </p>
            </div>

            {/* Quick Summary */}
            <section className="space-y-4">
                <h2 className="text-lg font-semibold">Quick Summary</h2>
                <div className="rounded-xl border border-border/50 bg-card p-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <h3 className="text-sm font-medium mb-2">What others do</h3>
                            <ul className="text-xs text-muted-foreground space-y-1">
                                <li>• <strong>Marketplaces</strong> = try models</li>
                                <li>• <strong>Libraries</strong> = DIY infrastructure</li>
                                <li>• <strong>Frameworks</strong> = build apps</li>
                                <li>• <strong>Observability tools</strong> = see what happened</li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium mb-2">What Cencori does</h3>
                            <ul className="text-xs text-muted-foreground space-y-1">
                                <li>• <strong>Managed platform</strong> = ship to production</li>
                                <li>• <strong>Security guardrails</strong> = control what happens</li>
                                <li>• <strong>2-line SDK</strong> = integrate in minutes</li>
                                <li>• <strong>Works with everything</strong> = LangChain, CrewAI, or raw API</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Detailed Comparisons */}
            <section className="space-y-6">
                <h2 className="text-lg font-semibold">Detailed Comparisons</h2>

                {competitors.map((comp) => (
                    <div key={comp.name} className="rounded-xl border border-border/50 bg-card overflow-hidden">
                        {/* Header */}
                        <div className={`px-5 py-3 border-b border-border/40 flex items-center gap-3`}>
                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${comp.color}`}>
                                {comp.name}
                            </span>
                            <span className="text-sm font-medium">{comp.tagline}</span>
                        </div>

                        {/* Content */}
                        <div className="p-5 grid gap-4 md:grid-cols-2">
                            <div>
                                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">They do</h4>
                                <p className="text-sm">{comp.theyDo}</p>
                            </div>
                            <div>
                                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">We do</h4>
                                <p className="text-sm">{comp.weDo}</p>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="px-5 py-3 bg-muted/30 border-t border-border/40">
                            <p className="text-xs text-muted-foreground">
                                <strong className="text-foreground">Bottom line:</strong> {comp.summary}
                            </p>
                        </div>
                    </div>
                ))}
            </section>

            {/* FAQ */}
            <section className="space-y-4">
                <h2 className="text-lg font-semibold">Common Questions</h2>
                <div className="space-y-4">
                    <div className="rounded-xl border border-border/50 bg-card p-5">
                        <h3 className="text-sm font-medium mb-2">&quot;What does LangChain/LangGraph do?&quot;</h3>
                        <p className="text-xs text-muted-foreground">
                            LangChain is a <strong className="text-foreground">framework for building AI applications</strong>—chains, agents, RAG pipelines.
                            Cencori is <strong className="text-foreground">infrastructure for running AI safely</strong>—observability, security, failover.
                            They work together: LangChain builds, Cencori ships.
                        </p>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-card p-5">
                        <h3 className="text-sm font-medium mb-2">&quot;Why not just use OpenRouter?&quot;</h3>
                        <p className="text-xs text-muted-foreground">
                            OpenRouter is great for <strong className="text-foreground">experimentation</strong>—try different models, pay-as-you-go.
                            Cencori is for <strong className="text-foreground">production</strong>—use your own API keys, get audit logs, security guardrails,
                            and failover. If you're shipping to customers, you need infrastructure, not a marketplace.
                        </p>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-card p-5">
                        <h3 className="text-sm font-medium mb-2">&quot;Is Cencori open source?&quot;</h3>
                        <p className="text-xs text-muted-foreground">
                            The SDK is open source. The platform is managed—we handle the infrastructure so you can focus on your product.
                            If you need self-hosted, <Link href="/contact" className="text-primary hover:underline">contact us</Link>.
                        </p>
                    </div>
                </div>
            </section>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-8 border-t border-border/40">
                <Button variant="ghost" size="sm" className="gap-1" asChild>
                    <Link href="/docs/concepts/multi-provider">
                        <ChevronLeft className="h-3 w-3" />
                        Multi-Provider
                    </Link>
                </Button>
                <Button variant="ghost" size="sm" className="gap-1" asChild>
                    <Link href="/docs/quickstart">
                        Quickstart
                        <ChevronRight className="h-3 w-3" />
                    </Link>
                </Button>
            </div>
        </div>
    );
}
