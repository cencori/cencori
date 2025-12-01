import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function IntroductionPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Introduction to Cencori
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Learn what Cencori is, how it works, and why it&apos;s the best choice for building production AI applications.
                </p>
            </div>

            {/* What is Cencori */}
            <div className="space-y-4">
                <h2 id="what-is-cencori" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    What is Cencori?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Cencori is a developer-first AI infrastructure platform that sits between your application and AI providers (OpenAI, Anthropic, Google). It acts as a security layer, monitoring system, and cost optimization tool - all in one unified API.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Think of it as a reverse proxy for AI with built-in superpowers: automatic security scanning, complete audit logs, multi-provider support, and transparent cost tracking.
                </p>
            </div>

            {/* Why Cencori */}
            <div className="space-y-4">
                <h2 id="why-cencori" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Why Cencori?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Building AI features is easy. Building them securely, compliantly, and cost-effectively is hard. Cencori solves this by providing:
                </p>

                <div className="space-y-6 mt-6">
                    <div className="space-y-2">
                        <h3 className="text-base font-semibold">1. Security by Default</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Every request is automatically scanned for PII, prompt injection attempts, and harmful content. You ship secure AI without writing a single line of security code.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-base font-semibold">2. Multi-Provider Freedom</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Switch between OpenAI, Anthropic, and Google Gemini with one parameter change. No vendor lock-in, no code rewrites, just flexibility.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-base font-semibold">3. Complete Observability</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            See every request, every token, every dollar spent. Real-time analytics, security incident tracking, and cost breakdown by provider and model.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-base font-semibold">4. Compliance Made Easy</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Complete audit logs, PII filtering, and security monitoring give you the compliance story your enterprise customers demand.
                        </p>
                    </div>
                </div>
            </div>

            {/* How It Works */}
            <div className="space-y-4">
                <h2 id="how-it-works" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    How It Works
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Cencori sits between your application and AI providers:
                </p>

                <div className="my-6 p-6 bg-muted/20 border border-border/40 rounded-lg">
                    <pre className="text-xs">
                        {`Your App → Cencori API → AI Provider (OpenAI/Anthropic/Google)
           ↓
    Security Check
    Cost Tracking
    Logging
    Analytics`}
                    </pre>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed">
                    Instead of calling OpenAI directly, you call Cencori. We forward the request to the appropriate provider, scan it for security threats, log everything, and return the response. Your users get the same AI quality, but you get security, logs, and insights automatically.
                </p>
            </div>

            {/* Key Features */}
            <div className="space-y-4">
                <h2 id="key-features" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Key Features
                </h2>

                <ul className="space-y-3 text-sm ml-6">
                    <li className="list-disc">
                        <strong>Multi-Provider Support:</strong> OpenAI (GPT-4, GPT-3.5), Anthropic (Claude 3), Google (Gemini 2.x)
                    </li>
                    <li className="list-disc">
                        <strong>Security Scanning:</strong> Automatic PII detection, prompt injection protection, content filtering
                    </li>
                    <li className="list-disc">
                        <strong>Real-Time Streaming:</strong> Server-Sent Events for all providers with token-by-token responses
                    </li>
                    <li className="list-disc">
                        <strong>Credits-Based Billing:</strong> Prepaid credits with transparent pricing and provider cost breakdown
                    </li>
                    <li className="list-disc">
                        <strong>Complete Audit Logs:</strong> Every request logged with full metadata, searchable and exportable
                    </li>
                    <li className="list-disc">
                        <strong>Custom Providers:</strong> Bring your own OpenAI/Anthropic-compatible endpoints
                    </li>
                    <li className="list-disc">
                        <strong>Rate Limiting:</strong> Built-in rate limits per project, per user, per organization
                    </li>
                    <li className="list-disc">
                        <strong>Analytics Dashboard:</strong> Cost tracking, usage patterns, security incidents, performance metrics
                    </li>
                </ul>
            </div>

            {/* Use Cases */}
            <div className="space-y-4">
                <h2 id="use-cases" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Common Use Cases
                </h2>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <h3 className="text-base font-semibold">AI Product Companies</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Building AI-powered SaaS? Cencori gives you enterprise-grade security and compliance out of the box, so you can focus on your product instead of infrastructure.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-base font-semibold">Developers Using AI Tools</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Using Cursor, Lovable, or other AI coding tools? Wrap them with Cencori to monitor costs, filter sensitive data, and ensure nothing harmful gets through.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-base font-semibold">Enterprise AI Integration</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Need to deploy AI in a regulated industry? Cencori provides the audit logs, PII filtering, and security monitoring that compliance teams require.
                        </p>
                    </div>
                </div>
            </div>

            {/* Architecture */}
            <div className="space-y-4">
                <h2 id="architecture" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Architecture Overview
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Cencori is built on modern, scalable infrastructure:
                </p>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Layer</th>
                                <th className="text-left p-3 font-semibold">Technology</th>
                                <th className="text-left p-3 font-semibold">Purpose</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3">Framework</td>
                                <td className="p-3">Next.js 15</td>
                                <td className="p-3">Full-stack platform</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">Database</td>
                                <td className="p-3">Supabase (PostgreSQL)</td>
                                <td className="p-3">Data storage & auth</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">Language</td>
                                <td className="p-3">TypeScript</td>
                                <td className="p-3">Type-safe development</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">Deployment</td>
                                <td className="p-3">Vercel</td>
                                <td className="p-3">Edge hosting & CI/CD</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">AI Providers</td>
                                <td className="p-3">OpenAI, Anthropic, Google</td>
                                <td className="p-3">Multi-provider support</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Getting Started */}
            <div className="space-y-4">
                <h2 id="getting-started" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Ready to Get Started?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Follow our Quick Start guide to be up and running in under 5 minutes:
                </p>
                <div className="flex gap-4 mt-4">
                    <Link href="/docs/quick-start">
                        <Button>
                            Quick Start Guide
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                    <Link href="/dashboard">
                        <Button variant="outline">
                            Go to Dashboard
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-end items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/quick-start">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Quick Start</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
