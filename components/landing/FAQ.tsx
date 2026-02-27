"use client";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

const faqData = [
    {
        id: "how-it-works",
        question: "How does Cencori actually work?",
        answer: "Cencori is a complete platform for shipping AI to production. It includes an AI gateway for routing and security, compute for running models, and tools for workflows and observability. You integrate once with Cencori, and we handle infrastructure (security checks, compute, cost tracking) so you can focus on your product."
    },
    {
        id: "supported-models",
        question: "What AI models and providers do you support?",
        answer: "We support 14+ AI providers with 75+ models including: OpenAI (GPT-5, GPT-4o, o3), Anthropic (Claude Opus 4, Sonnet 4), Google (Gemini 3 Pro, Gemini 2.5 Flash), xAI (Grok 4), Mistral (Large 3), DeepSeek (V3.2), Cohere (Command A), Perplexity (Sonar Pro), and more. You can switch between models dynamically - no code changes needed.",
        content: "We support 14+ AI providers with 75+ models including: OpenAI (GPT-5, GPT-4o, o3), Anthropic (Claude Opus 4, Sonnet 4), Google (Gemini 3 Pro, Gemini 2.5 Flash), xAI (Grok 4), Mistral (Large 3), DeepSeek (V3.2), Cohere (Command A), Perplexity (Sonar Pro), Meta (Llama 4), and more. You can switch between models dynamically - no code changes needed. BYOK (Bring Your Own Key) is fully supported!"
    },
    {
        id: "latency",
        question: "What's the latency overhead?",
        answer: "Typically 10-50ms added latency for security checks. Our servers are globally distributed on Vercel's edge network, so requests are routed from the nearest location. For most use cases, this is imperceptible - the AI model generation time (often 1-5 seconds) dominates total latency."
    },
    {
        id: "environments",
        question: "What's the difference between Production and Development environments?",
        answer: "Each project has separate Production and Development environments with isolated API keys. Production keys (start with cen_) count toward your tier limits and are logged for compliance. Development keys (start with cen_test_) don't count toward limits, perfect for testing. This lets you iterate safely without affecting production quotas or compliance logs.",
        content: (
            <>
                <p className="mb-2">Each project has separate Production and Development environments with isolated API keys:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><strong className="text-foreground">Production</strong> keys (start with <code className="bg-muted px-1 rounded">cen_</code>): Count toward your tier limits, logged for compliance</li>
                    <li><strong className="text-foreground">Development</strong> keys (start with <code className="bg-muted px-1 rounded">cen_test_</code>): Don&apos;t count toward limits, perfect for testing</li>
                </ul>
                <p className="mt-2">This lets you iterate safely without affecting production quotas or compliance logs.</p>
            </>
        )
    },
    {
        id: "request-limits",
        question: "What happens when I hit my request limit?",
        answer: "We return a 429 error with details about your usage and upgrade options. Your app can handle this gracefully by showing users a message or queuing requests. You can upgrade your plan mid-month instantly - higher limits apply immediately, and we prorate the difference."
    },
    {
        id: "data-security",
        question: "Is my data secure? Where do you store requests and responses?",
        answer: "Yes. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We store request/response logs in Supabase (SOC 2 compliant) for audit and analytics purposes. Logs are retained for 90 days by default (customizable for enterprise). We never train models on your data or share it with third parties.",
        content: "Yes. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We store request/response logs in Supabase (SOC 2 compliant) for audit and analytics purposes. Logs are retained for 90 days by default (customizable for enterprise). We never train models on your data or share it with third parties. SOC 2 Type II compliance is in progress (expected Q2 2025)."
    },
    {
        id: "project-level",
        question: "Can I use this for just one project or do I need to migrate everything?",
        answer: "Cencori is project-scoped, so you can start with just one app or feature. Each project gets its own API keys, quotas, and analytics. No need for an all-or-nothing migration - add projects as you need them. Many customers start with their highest-risk or highest-value feature first."
    },
    {
        id: "vs-openai",
        question: "How is Cencori different from using OpenAI directly?",
        answer: "OpenAI gives you the model. Cencori gives you everything else — the infrastructure for AI production. This includes security (prompt injection, PII detection, content filtering), multi-provider routing (switch between GPT-4, Claude, Gemini), audit logs and compliance (SOC 2, GDPR), cost tracking (spend per user/feature), plus compute and workflow capabilities. Think of it as the difference between renting a database vs. using Supabase.",
        content: (
            <>
                <p className="mb-2">OpenAI gives you the model. Cencori gives you production-ready AI infrastructure:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Security (prompt injection, PII detection, content filtering)</li>
                    <li>Multi-provider support (switch between GPT-4, Claude, Gemini)</li>
                    <li>Audit logs &amp; compliance (SOC 2, GDPR)</li>
                    <li>Cost optimization (track spend per user/feature)</li>
                    <li>Cost tracking (spend per user/feature)</li>
                </ul>
                <p className="mt-2">Think of it as the difference between renting a database vs. using Supabase.</p>
            </>
        )
    },
    {
        id: "what-is-cencori",
        question: "What is Cencori?",
        answer: "Cencori is the infrastructure for AI production. We provide a complete platform for shipping AI — from an API gateway with multi-provider routing and security, to compute, workflows, and observability. Whether you're building a chatbot or orchestrating agents, Cencori handles infrastructure so you can focus on your product."
    },
];

const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqData.map(item => ({
        "@type": "Question",
        "name": item.question,
        "acceptedAnswer": {
            "@type": "Answer",
            "text": item.answer
        }
    }))
};

export function FAQ() {
    return (
        <section className="py-24 bg-background">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(faqSchema),
                }}
            />
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        Frequently Asked Questions
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        Everything you need to know about Cencori
                    </p>
                </div>

                <Accordion type="single" collapsible className="w-full space-y-4">
                    {faqData.map((item) => (
                        <AccordionItem key={item.id} value={item.id} className="border rounded-lg px-6 bg-card">
                            <AccordionTrigger className="text-left hover:no-underline">
                                {item.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-muted-foreground">
                                {item.content || item.answer}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>

                <div className="mt-12 text-center">
                    <p className="text-muted-foreground mb-4">
                        Still have questions?
                    </p>
                    <a
                        href="mailto:support@cencori.com"
                        className="text-primary hover:underline font-medium"
                    >
                        Contact our team →
                    </a>
                </div>
            </div>
        </section>
    );
}

