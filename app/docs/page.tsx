import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DocsPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-20">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Cencori Documentation
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Cencori is the essential security and compliance layer for AI-integrated applications.
                    It sits between your users and your AI models, ensuring safety, observability, and control.
                </p>
            </div>

            {/* The Problem We Solve */}
            <div className="space-y-4">
                <h2 id="the-problem" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    The Problem We Solve
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Modern applications are increasingly powered by AI, but this introduces unprecedented security and operational challenges:
                </p>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">
                        <strong>Prompt Injection Attacks:</strong> Malicious users can manipulate AI responses by injecting instructions into prompts, potentially exposing sensitive data or bypassing security controls.
                    </li>
                    <li className="list-disc">
                        <strong>PII & Data Leakage:</strong> Without proper filtering, users can inadvertently send personally identifiable information (PII) or sensitive business data to third-party AI providers.
                    </li>
                    <li className="list-disc">
                        <strong>Uncontrolled Costs:</strong> AI APIs charge per token. Without rate limiting and monitoring, a single bug or bad actor can drain your budget overnight.
                    </li>
                    <li className="list-disc">
                        <strong>No Audit Trail:</strong> Compliance frameworks (SOC 2, GDPR, HIPAA) require immutable logs of all AI interactions. Most teams build this from scratch.
                    </li>
                    <li className="list-disc">
                        <strong>Model Lock-In:</strong> Switching between OpenAI, Anthropic, or Google requires rewriting integration code and losing observability continuity.
                    </li>
                    <li className="list-disc">
                        <strong>Blind Spots:</strong> You can't debug what you can't see. When AI responses are wrong, you need to inspect the exact prompt and model parameters.
                    </li>
                </ul>
            </div>

            {/* Why Cencori */}
            <div className="space-y-4">
                <h2 id="why-cencori" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Why Cencori?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Cencori is purpose-built infrastructure for AI-powered applications. It provides the security, observability, and control layer that traditional web infrastructure (like firewalls, load balancers, and logging services) provides for standard HTTP traffic—but for AI.
                </p>

                <div className="space-y-3 mt-4">
                    <h3 className="text-base font-semibold">For Vibe Coders</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Build rapidly with tools like Cursor, v0, and Lovable while keeping your generated apps secure by default. Cencori acts as a safety net, catching security issues that AI coding assistants might miss.
                    </p>
                </div>

                <div className="space-y-3 mt-4">
                    <h3 className="text-base font-semibold">For AI Companies</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Enterprise-grade observability, audit logs, and policy enforcement for your AI features. Multi-tenant rate limiting, cost attribution, and compliance reporting out of the box.
                    </p>
                </div>
            </div>

            {/* How It Works */}
            <div className="space-y-4">
                <h2 id="how-it-works" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    How It Works
                </h2>
                <p className="text-sm leading-relaxed">
                    Cencori acts as a transparent proxy layer between your application and AI providers. Instead of calling OpenAI, Anthropic, or Google directly, you route requests through Cencori.
                </p>

                <div className="my-8 p-6 border border-border/40 bg-muted/5">
                    <div className="flex items-center justify-center gap-4 md:gap-8">
                        {/* Your Application */}
                        <div className="flex-1 max-w-[140px]">
                            <div className="border-2 border-border bg-background p-4 text-center">
                                <div className="text-xs font-semibold mb-1">Your</div>
                                <div className="text-xs font-semibold">Application</div>
                            </div>
                        </div>

                        {/* Arrow Right */}
                        <div className="flex items-center gap-1">
                            <div className="h-[2px] w-8 md:w-12 bg-border"></div>
                            <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-border border-b-[6px] border-b-transparent"></div>
                        </div>

                        {/* Cencori (highlighted) */}
                        <div className="flex-1 max-w-[140px]">
                            <div className="border-2 bg-primary/5 p-4 text-center">
                                <div className="text-xs font-bold text-primary">Cencori</div>
                            </div>
                        </div>

                        {/* Arrow Right */}
                        <div className="flex items-center gap-1">
                            <div className="h-[2px] w-8 md:w-12 bg-border"></div>
                            <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-border border-b-[6px] border-b-transparent"></div>
                        </div>

                        {/* AI Models */}
                        <div className="flex-1 max-w-[140px]">
                            <div className="border-2 border-border bg-background p-4 text-center">
                                <div className="text-xs font-semibold mb-1">AI Models</div>
                            </div>
                        </div>
                    </div>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed">
                    Every AI request flows through Cencori's policy engine, which checks for:
                </p>
                <ul className="space-y-1.5 text-sm ml-6 mt-2">
                    <li className="list-disc">Security threats (prompt injection, jailbreaks)</li>
                    <li className="list-disc">PII and sensitive data</li>
                    <li className="list-disc">Rate limits and cost thresholds</li>
                    <li className="list-disc">Compliance requirements</li>
                </ul>
            </div>

            {/* Core Features */}
            <div className="space-y-4">
                <h2 id="core-features" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Core Features
                </h2>

                <div className="space-y-4">
                    <div>
                        <h3 className="text-base font-semibold mb-2">Immutable Audit Logging</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                            Every AI request and response is logged with complete context:
                        </p>
                        <ul className="space-y-1 text-sm ml-6">
                            <li className="list-disc">Full prompt and completion text</li>
                            <li className="list-disc">Model parameters (temperature, max tokens)</li>
                            <li className="list-disc">User identity and session metadata</li>
                            <li className="list-disc">Token usage and cost attribution</li>
                            <li className="list-disc">Timestamps and request IDs for tracing</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Real-Time Threat Detection</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                            Cencori identifies and blocks malicious activity before it reaches your AI providers:
                        </p>
                        <ul className="space-y-1 text-sm ml-6">
                            <li className="list-disc">Prompt injection attempts</li>
                            <li className="list-disc">Jailbreak patterns</li>
                            <li className="list-disc">PII exposure risks</li>
                            <li className="list-disc">Excessive token usage spikes</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Granular Rate Limiting</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                            Control costs and prevent abuse with multi-dimensional limits:
                        </p>
                        <ul className="space-y-1 text-sm ml-6">
                            <li className="list-disc">Per-user request limits</li>
                            <li className="list-disc">Per-organization token budgets</li>
                            <li className="list-disc">Model-specific throttling</li>
                            <li className="list-disc">Time-based quotas (hourly, daily, monthly)</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Multi-Provider Support</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                            Switch between AI providers without changing your application code. Cencori provides a unified API that works with all major providers.
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <div className="flex-1">
                    {/* No previous page */}
                </div>
                <Link href="/docs/quick-start">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Quick Start</span>
                        </span>
                    </Button>
                </Link>
            </div>
        </div>
    );
}
