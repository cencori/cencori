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
};

