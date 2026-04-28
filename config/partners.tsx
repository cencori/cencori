import { PartnerConfig } from "@/types/partner";
import React from "react";
import Image from "next/image";
import {
    CursorLogo,
    VSCodeLogo,
    WindsurfLogo,
    ClaudeLogo,
    LovableLogo,
    ReplitLogo,
    V0Logo,
    BoltLogo,
    NextjsLogo,
    ReactLogo,
    VueLogo,
    SvelteLogo,
    ViteLogo,
    PythonLogo,
    RagMetricsLogo,
} from "@/components/icons/BrandIcons";

export const partners: Record<string, PartnerConfig> = {
    "cursor": {
        slug: "cursor",
        name: "Cursor",
        category: "Code Editor",
        logo: CursorLogo,
        websiteUrl: "https://cursor.com",
        docsUrl: "https://docs.cursor.com",
        screenshots: ["/partners/cursor/1.png", "/partners/cursor/2.png", "/partners/cursor/3.png"],
        overview: {
            title: "What is Cursor?",
            content: (
                <>
                    <p className="mb-4">
                        Cursor is an AI-powered code editor built on top of VS Code. It is designed to help you write code faster and more accurately by providing intelligent suggestions, automated refactoring, and real-time error detection.
                    </p>
                    <p>
                        By integrating with Cencori, Cursor users get enterprise-grade security and observability. Every request sent from Cursor to an LLM is routed through the Cencori Gateway, where sensitive data is masked and usage is logged for full auditability.
                    </p>
                </>
            ),
        },
        hero: {
            title: (
                <>
                    Ship AI apps with Cursor.
                    <br />
                    <span className="text-muted-foreground">Governed by Cencori.</span>
                </>
            ),
            subtitle: "The world's most advanced AI code editor, now with enterprise-grade security and observability via Cencori.",
            cta: { text: "Install Extension", href: "https://cursor.com" },
            secondaryCta: { text: "View Docs", href: "/docs/integrations/cursor" },
        },
        integrations: {
            editors: [{ name: "Cursor", logo: CursorLogo }],
            platforms: [{ name: "Next.js", logo: NextjsLogo }, { name: "Vite", logo: ViteLogo }],
            frameworks: [{ name: "React", logo: ReactLogo }, { name: "TypeScript", logo: NextjsLogo }], // Using NextjsLogo as a placeholder if TS is missing
        },
        features: {
            title: "Why Cursor + Cencori",
            subtitle: "Combining the fastest coding experience with the most secure infrastructure.",
            items: [
                { title: "One-click Setup", desc: "Just point your Cursor environment variables to Cencori and get instant observability." },
                { title: "Prompt Protection", desc: "Cencori automatically filters PII and sensitive data before it leaves your local environment." },
                { title: "Cost Attribution", desc: "Track exactly how much each team member is spending on LLM tokens from within Cursor." },
            ],
        },
        codeSection: {
            title: "Setup in seconds.",
            subtitle: "Zero configuration needed.",
            fileName: ".env.local",
            code: "CENCORI_API_KEY=csk_live_...\nCENCORI_GATEWAY_URL=https://gateway.cencori.com",
        },
        promptsSection: {
            title: "Cursor Prompts",
            subtitle: "Use these to bootstrap your Cencori projects.",
            items: [
                { title: "New Cencori Project", prompt: "Create a new Next.js app and install the 'cencori' package. Setup a basic chat route that uses the Cencori AI gateway." },
            ],
        },
        pricingCallout: {
            title: "Free for Developers.",
            subtitle: "Cencori's hobby tier is perfectly matched for Cursor power users.",
            cta: { text: "Start Free", href: "/signup" },
        },
        bottomCta: {
            title: "Build the future.",
            subtitle: "Your AI-written code deserves production-ready governance.",
            primaryCta: { text: "Get Started", href: "/signup" },
            secondaryCta: { text: "Documentation", href: "/docs" },
        },
    },
    "claude": {
        slug: "claude",
        name: "Claude",
        category: "AI Model",
        logo: ClaudeLogo,
        websiteUrl: "https://anthropic.com",
        docsUrl: "https://docs.anthropic.com",
        screenshots: ["/partners/claude/1.png", "/partners/claude/2.png", "/partners/claude/3.png"],
        overview: {
            title: "What is Claude?",
            content: (
                <>
                    <p className="mb-4">
                        Claude is a family of large language models developed by Anthropic. Known for its high ethical standards and helpfulness, Claude excels at complex reasoning, coding, and creative writing.
                    </p>
                    <p>
                        Cencori provides the governance layer required to deploy Claude in enterprise environments. With Cencori, you can enforce security policies, manage costs across different Claude models, and ensure high availability with automatic failover to other providers.
                    </p>
                </>
            ),
        },
        hero: {
            title: (
                <>
                    The power of Claude.
                    <br />
                    <span className="text-muted-foreground">The safety of Cencori.</span>
                </>
            ),
            subtitle: "Access Anthropic's state-of-the-art models with built-in PII filtering, rate limiting, and failover.",
            cta: { text: "Try Claude 3.5", href: "/playground" },
            secondaryCta: { text: "Pricing", href: "/pricing" },
        },
        integrations: {
            editors: [{ name: "Claude", logo: ClaudeLogo }],
            platforms: [{ name: "Vercel", logo: NextjsLogo }],
            frameworks: [{ name: "Next.js", logo: NextjsLogo }, { name: "Python", logo: PythonLogo }],
        },
        features: {
            title: "Enterprise Claude",
            subtitle: "Scale your Anthropic workloads with confidence.",
            items: [
                { title: "Failover Support", desc: "Automatically switch to OpenAI or Gemini if Claude hits a rate limit or goes down." },
                { title: "PII Masking", desc: "Protect user privacy by masking sensitive data before it's sent to Anthropic's servers." },
                { title: "Usage Insights", desc: "Granular breakdown of Claude token usage across your entire organization." },
            ],
        },
        codeSection: {
            title: "Model Switching.",
            subtitle: "One API, multiple providers.",
            fileName: "route.ts",
            code: "import { cencori } from 'cencori';\n\nconst model = cencori('claude-3-5-sonnet');",
        },
        promptsSection: {
            title: "Anthropic Prompts",
            subtitle: "Optimize your Claude interactions.",
            items: [
                { title: "Structured Output", prompt: "Generate a JSON schema for a customer support ticket using Claude 3.5 Sonnet and Cencori." },
            ],
        },
        pricingCallout: {
            title: "Enterprise Ready.",
            subtitle: "Cencori provides the governance layer required by security teams for Anthropic deployments.",
            cta: { text: "Contact Sales", href: "/contact" },
        },
        bottomCta: {
            title: "Ready to switch?",
            subtitle: "Stop managing multiple API keys. Use Cencori.",
            primaryCta: { text: "Get Started Free", href: "/signup" },
            secondaryCta: { text: "View Models", href: "/ai/models" },
        },
    },
    "ragmetrics": {
        slug: "ragmetrics",
        name: "RagMetrics",
        category: "AI Evaluation",
        logo: RagMetricsLogo,
        websiteUrl: "https://ragmetrics.ai",
        docsUrl: "https://docs.ragmetrics.ai",
        screenshots: ["/partners/ragmetrics/1.png", "/partners/ragmetrics/2.png", "/partners/ragmetrics/3.png"],
        overview: {
            title: "Control every request. Evaluate every output.",
            content: (
                <>
                    <div className="space-y-12">
                        <section className="space-y-6">
                            <p>
                                The moment you ship AI to real users, two things can go wrong — bad inputs reach your models, and bad outputs reach your users. Most teams fix one. We fix both.
                            </p>
                            <p>
                                Cencori secures, routes, and monitors every AI request from the moment it enters your pipeline. RagMetrics evaluates the quality and accuracy of every AI response before it reaches a human or downstream workflow.
                            </p>
                        </section>

                        <section className="space-y-8 pt-8 border-t border-border/10">
                            <h3 className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Operational Workflow</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="space-y-3">
                                    <p className="text-xs font-medium text-foreground uppercase tracking-tight">01. Request</p>
                                    <p className="text-muted-foreground leading-snug">Input is intercepted by Cencori Gateway. PII is masked and security policies are enforced.</p>
                                </div>
                                <div className="space-y-3">
                                    <p className="text-xs font-medium text-foreground uppercase tracking-tight">02. Control</p>
                                    <p className="text-muted-foreground leading-snug">Request is routed to the optimal model with automatic failover and cost tracking.</p>
                                </div>
                                <div className="space-y-3">
                                    <p className="text-xs font-medium text-foreground uppercase tracking-tight">03. Evaluate</p>
                                    <p className="text-muted-foreground leading-snug">RagMetrics scores the output against 225+ criteria before it reaches the end user.</p>
                                </div>
                            </div>
                        </section>

                        <section className="space-y-8 pt-8 border-t border-border/10">
                            <h3 className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Industry Verticalization</h3>
                            <div className="space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <p className="text-xs font-mono text-zinc-500 uppercase">Financial</p>
                                    <p className="md:col-span-3 text-muted-foreground">AI-assisted research and client comms. Cencori caps spend per desk; RagMetrics catches hallucinations before they reach advisors.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <p className="text-xs font-mono text-zinc-500 uppercase">Healthcare</p>
                                    <p className="md:col-span-3 text-muted-foreground">Clinical AI documentation. Cencori filters PHI; RagMetrics evaluates summary accuracy to meet HIPAA-eligibility standards.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <p className="text-xs font-mono text-zinc-500 uppercase">SaaS</p>
                                    <p className="md:col-span-3 text-muted-foreground">Multi-tenant AI features. Cencori enforces per-customer billing; RagMetrics monitors model drift and quality live.</p>
                                </div>
                            </div>
                        </section>

                        <section className="space-y-8 pt-8 border-t border-border/10">
                            <h3 className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">The 2026 Mandate</h3>
                            <div className="space-y-6 text-muted-foreground leading-relaxed">
                                <p>
                                    Enterprises spent 2024 experimenting. 2026 is the year regulators started issuing consequences.
                                    The Pieces Technologies enforcement and UnitedHealth federal court rulings have established a new baseline: 
                                    <span className="text-foreground font-normal"> If you cannot verify your AI outputs, you are exposed.</span>
                                </p>
                                <p>
                                    FINRA's 2026 report and the EU AI Act Phase 2 now mandate output validation for regulated AI deployments. 
                                    This partnership provides the only integrated stack that closes the governance loop from input to output.
                                </p>
                            </div>
                        </section>
                    </div>
                </>
            ),
        },
        hero: {
            title: (
                <>
                    CENCORI × RAGMETRICS
                    <br />
                    <span className="text-muted-foreground">Full-stack Governance.</span>
                </>
            ),
            subtitle: "Every request secured. Every output evaluated. One integration for verified AI production.",
            cta: { text: "Book Joint Demo", href: "mailto:partnership@ragmetrics.ai" },
            secondaryCta: { text: "View Criteria", href: "https://docs.ragmetrics.ai" },
        },
        integrations: {
            editors: [{ name: "RagMetrics", logo: RagMetricsLogo }],
            platforms: [{ name: "Next.js", logo: NextjsLogo }],
            frameworks: [{ name: "Python", logo: PythonLogo }],
        },
        features: {
            title: "Input + Output Control",
            subtitle: "The complete stack for production AI.",
            items: [
                { title: "225+ Eval Criteria", desc: "RagMetrics scores every response against hallucination and bias metrics." },
                { title: "Sub-second Eval", desc: "Proprietary SLMs ensure evaluation overhead is unnoticeable." },
                { title: "Closed-loop", desc: "Automatically trigger retries or human-in-the-loop flows." },
            ],
        },
        codeSection: {
            title: "Integrated Stack.",
            subtitle: "Request control meets output scoring.",
            fileName: "governance.ts",
            code: "import { cencori } from 'cencori';\nimport { ragmetrics } from 'ragmetrics';\n\nconst prompt = await cencori.filter(input);\nconst response = await cencori.route(prompt);\nconst score = await ragmetrics.evaluate(response);",
        },
        promptsSection: {
            title: "Evaluation Prompts",
            subtitle: "Bootstrap your pipeline.",
            items: [
                { title: "Consistency Check", prompt: "Evaluate for factual consistency against the provided context." },
            ],
        },
        pricingCallout: {
            title: "Partnership Pricing.",
            subtitle: "Special joint rates for full-stack AI governance.",
            cta: { text: "Contact", href: "mailto:partnership@ragmetrics.ai" },
        },
        bottomCta: {
            title: "Verified AI.",
            subtitle: "Stop managing multiple API keys. Use Cencori x RagMetrics.",
            primaryCta: { text: "Book Demo", href: "mailto:partnership@ragmetrics.ai" },
            secondaryCta: { text: "Docs", href: "/docs" },
        },
    },
};

