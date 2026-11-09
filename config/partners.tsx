import { PartnerConfig } from "@/types/partner";
import React from "react";
import {
    CursorLogo,
    ClaudeLogo,
    NextjsLogo,
    ReactLogo,
    ViteLogo,
    PythonLogo,
} from "@/components/icons/BrandIcons";

/** CostGraph's mark, from their brand assets (public/integrations/costgraph.svg). */
function CostGraphLogo({ className }: { className?: string }) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/integrations/costgraph.svg" alt="" className={className} />;
}


/** Partner wordmarks supplied as PNGs (same files as the landing page rail). */
function wordmark(src: string, tone: "black" | "white") {
    // Black marks flip to white on the dark theme; white marks flip the other way.
    const polarity = tone === "black" ? "dark:invert" : "invert dark:invert-0";
    function Wordmark({ className }: { className?: string }) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={src} alt="" className={`${className ?? ""} object-left ${polarity}`} />;
    }
    return Wordmark;
}

const SpitchLogo = wordmark("/logos/partners/spitch.png", "black");
const CeloLogo = wordmark("/logos/partners/celo.png", "black");
const UnivadLogo = wordmark("/logos/partners/univad-white.png", "white");

/** Fields the partner detail page doesn't render yet, kept minimal. */
function basics(name: string, href: string) {
    return {
        integrations: { editors: [], platforms: [], frameworks: [] },
        codeSection: { title: "", subtitle: "", code: "", fileName: "" },
        promptsSection: { title: "", subtitle: "", items: [] },
        pricingCallout: { title: "", subtitle: "", cta: { text: "Get started", href } },
        bottomCta: {
            title: `Build with ${name} on Cencori.`,
            subtitle: "",
            primaryCta: { text: "Get started", href: "/signup" },
            secondaryCta: { text: "Documentation", href: "/docs" },
        },
    };
}

export const partners: Record<string, PartnerConfig> = {
    "costgraph": {
        slug: "costgraph",
        name: "CostGraph",
        category: "FinOps",
        logo: CostGraphLogo,
        websiteUrl: "https://costgraph.ai",
        docsUrl: "/docs/integrations/costgraph",
        overview: {
            title: "What is CostGraph?",
            content: (
                <>
                    <p className="mb-4">
                        CostGraph is a FinOps platform that puts cloud, Kubernetes, GPU and AI spend in one place, connecting usage and spend to the workloads, teams and customers behind it.
                    </p>
                    <p className="mb-4">
                        Connect your Cencori organization and every request through the gateway shows up in CostGraph as FOCUS 1.2 cost records, broken down by project, model, provider, kind of work and token type. Costs are what Cencori billed, and usage on your own provider keys is reported at zero cost so nothing is counted twice.
                    </p>
                    <p>
                        Connect in one click from any project&apos;s Settings → Integrations, or create a read-only usage export key and start from CostGraph. Cencori also publishes its per-token model rates to CostGraph&apos;s pricing catalogue.
                    </p>
                </>
            ),
        },
        hero: {
            title: (
                <>
                    Your AI spend in CostGraph.
                    <br />
                    <span className="text-muted-foreground">Next to the rest of your cloud bill.</span>
                </>
            ),
            subtitle: "See Cencori AI spend alongside your cloud, Kubernetes and GPU costs, broken down by project, model and customer.",
            cta: { text: "Connect CostGraph", href: "/docs/integrations/costgraph" },
            secondaryCta: { text: "Read the announcement", href: "/newsroom/cencori-costgraph-partnership" },
        },
        integrations: {
            editors: [],
            platforms: [{ name: "CostGraph", logo: CostGraphLogo }],
            frameworks: [],
        },
        features: {
            title: "Why CostGraph + Cencori",
            subtitle: "AI spend managed like the rest of your infrastructure.",
            items: [
                { title: "One-click connect", desc: "Connect from Cencori's console. This month's usage arrives straight away, then each day after it closes." },
                { title: "FOCUS 1.2 records", desc: "Cost by project, model, provider, kind of work and token type, in the FinOps Foundation's open format." },
                { title: "No double counting", desc: "Usage on your own provider keys is reported at zero cost, because your provider already bills you for it." },
            ],
        },
        codeSection: {
            title: "Pull usage yourself.",
            subtitle: "Read-only usage export key.",
            fileName: "terminal",
            code: "curl https://api.cencori.com/v1/usage/focus \\\n  -H \"Authorization: Bearer $CENCORI_USAGE_EXPORT_KEY\"",
        },
        promptsSection: {
            title: "CostGraph",
            subtitle: "Questions to ask of your AI spend.",
            items: [],
        },
        pricingCallout: {
            title: "Included on every CostGraph plan.",
            subtitle: "Cencori support is available on all CostGraph plans.",
            cta: { text: "Get started", href: "https://costgraph.ai" },
        },
        bottomCta: {
            title: "See where your AI spend goes.",
            subtitle: "Connect Cencori to CostGraph in one click.",
            primaryCta: { text: "Read the guide", href: "/docs/integrations/costgraph" },
            secondaryCta: { text: "Usage export", href: "/docs/platform/usage-export" },
        },
    },
    "spitch": {
        slug: "spitch",
        name: "Spitch",
        category: "Voice AI",
        logo: SpitchLogo,
        logoWide: true,
        websiteUrl: "https://spitch.app",
        docsUrl: "/docs/api/voice",
        overview: {
            title: "What is Spitch?",
            content: (
                <>
                    <p className="mb-4">
                        Spitch builds speech models for African languages: text-to-speech and speech-to-text for Yoruba, Hausa, Igbo, English and Amharic, built for those languages rather than adapted from English models.
                    </p>
                    <p>
                        Spitch is available through the Cencori Voice API. Pick a Spitch model and every call is metered, logged and PII-redacted through the gateway, with spend caps, cost tracking and bring-your-own-key support per project.
                    </p>
                </>
            ),
        },
        hero: {
            title: "Spitch on Cencori.",
            subtitle: "Speech-to-text and text-to-speech for Yoruba, Hausa, Igbo, English and Amharic through the Cencori Voice API.",
            cta: { text: "Read the docs", href: "/docs/api/voice" },
        },
        features: {
            title: "Why Spitch + Cencori",
            subtitle: "African-language voice through one gateway.",
            items: [
                { title: "Native languages", desc: "Yoruba, Hausa, Igbo, English and Amharic, in both directions." },
                { title: "One API", desc: "The same Voice API as every other provider on Cencori." },
                { title: "Ops built in", desc: "Metering, logging, PII redaction and spend caps on every call." },
            ],
        },
        ...basics("Spitch", "https://spitch.app"),
    },
    "celo": {
        slug: "celo",
        name: "Celo",
        category: "Blockchain",
        logo: CeloLogo,
        logoWide: true,
        websiteUrl: "https://celo.org",
        docsUrl: "/docs/hackathons/celo-agents",
        overview: {
            title: "What is Celo?",
            content: (
                <>
                    <p className="mb-4">
                        Celo is a blockchain for the onchain economy: stablecoin payments, receipts, identity, reputation and low-cost settlement.
                    </p>
                    <p>
                        Agents built on Cencori can record proof of their runs on Celo. Cencori handles the AI side (model routing, agent identity, logs, security, usage and billing) and Celo handles the onchain side.
                    </p>
                </>
            ),
        },
        hero: {
            title: "Cencori agents, with proof on Celo.",
            subtitle: "Build agents on Cencori and record proof of each run onchain with Celo.",
            cta: { text: "Read the guide", href: "/docs/hackathons/celo-agents" },
        },
        features: {
            title: "Why Celo + Cencori",
            subtitle: "AI infrastructure meets the onchain economy.",
            items: [
                { title: "Agent infrastructure", desc: "Model routing, identity, logs, security and billing from Cencori." },
                { title: "Onchain proof", desc: "Optional receipts for agent runs on Celo." },
                { title: "Low-cost settlement", desc: "Stablecoin payments and settlement on Celo." },
            ],
        },
        ...basics("Celo", "https://celo.org"),
    },
    "univad": {
        slug: "univad",
        name: "Univad",
        category: "Builder Community",
        logo: UnivadLogo,
        logoWide: true,
        websiteUrl: "https://univad.org",
        docsUrl: "/docs",
        overview: {
            title: "What is Univad?",
            content: (
                <>
                    <p className="mb-4">
                        Univad empowers students and early-stage builders with the tools, knowledge and community they need to turn ideas into products. Its builder community has more than 10,000 students.
                    </p>
                    <p>
                        Through the partnership, Univad builders get access to Cencori&apos;s API and infrastructure, technical support, and entry- and mid-level internship and job opportunities. Cencori is building the reliability layer for AI across Africa; Univad is developing the talent layer.
                    </p>
                </>
            ),
        },
        hero: {
            title: "Univad and Cencori.",
            subtitle: "Cencori's API and infrastructure for Univad's 10,000+ student builders, with pathways to internships and roles.",
            cta: { text: "Read the announcement", href: "https://univad.org/blog/univad-partners-with-cencori-to-empower-the-next-generation-of-builders" },
        },
        features: {
            title: "Univad + Cencori",
            subtitle: "From learning to building.",
            items: [
                { title: "Real infrastructure", desc: "Univad builders build on Cencori's API, not toy environments." },
                { title: "Career pathways", desc: "Entry- and mid-level internship and job opportunities." },
                { title: "Technical support", desc: "Structured access to tools, support and collaborative initiatives." },
            ],
        },
        ...basics("Univad", "https://univad.org"),
    },
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

