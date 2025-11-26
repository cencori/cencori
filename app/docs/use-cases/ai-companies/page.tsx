import { CodeBlock } from "@/components/docs/CodeBlock";

export default function AICompaniesPage() {
    return (
        <div className="space-y-10">
            <div>
                <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">
                    For AI-Integrated Companies
                </h1>
                <p className="text-xl text-muted-foreground leading-relaxed">
                    You've integrated AI into your core product—spreadsheets, documents, design tools. Now you need enterprise-grade control.
                </p>
            </div>

            <div className="space-y-6">
                <h2 id="the-challenge" className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
                    The Enterprise AI Challenge
                </h2>
                <p className="leading-7 [&:not(:first-child)]:mt-6">
                    When AI becomes a feature of your B2B product, your customers demand the same security guarantees they expect from the rest of your stack.
                </p>
                <ul className="my-6 ml-6 list-disc [&>li]:mt-2">
                    <li><strong>Data Sovereignty:</strong> Where is the data going? Is it being logged?</li>
                    <li><strong>Cost Control:</strong> How do you prevent a single tenant from draining your LLM budget?</li>
                    <li><strong>Compliance:</strong> Can you produce an audit trail of every AI interaction?</li>
                    <li><strong>Reliability:</strong> What happens when OpenAI is down?</li>
                </ul>
            </div>

            <div className="space-y-6">
                <h2 id="enterprise-features" className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight">
                    Enterprise-Grade Infrastructure
                </h2>
                <p className="leading-7">
                    Cencori provides the missing infrastructure layer for your AI features.
                </p>

                <h3 id="multi-tenancy" className="text-xl font-semibold mt-8 mb-4">Multi-Tenancy & Rate Limiting</h3>
                <p className="leading-7 mb-4">
                    Assign quotas and rate limits per customer (tenant) to ensure fair usage and cost predictability.
                </p>
                <CodeBlock
                    filename="middleware/ai-limiter.ts"
                    code={`// Enforce limits per tenant
await cencori.limits.enforce({
  tenantId: user.organizationId,
  feature: "ai-summary",
  limit: 1000, // requests per month
  period: "monthly"
});`}
                />

                <h3 id="audit-logs" className="text-xl font-semibold mt-8 mb-4">Immutable Audit Logs</h3>
                <p className="leading-7 mb-4">
                    Every prompt and completion is logged securely. You can export these logs for compliance or debugging without building your own logging infrastructure.
                </p>

                <h3 id="policy-enforcement" className="text-xl font-semibold mt-8 mb-4">Policy Enforcement</h3>
                <p className="leading-7 mb-4">
                    Define global policies (e.g., "No PII in prompts", "Block jailbreak attempts") and enforce them across all your AI features instantly.
                </p>
            </div>

            <div className="space-y-6">
                <h2 id="integration" className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight">
                    Seamless Integration
                </h2>
                <p className="leading-7">
                    Cencori integrates with your existing observability stack (Datadog, Prometheus) and identity providers. It's designed to be the invisible, reliable backbone of your AI operations.
                </p>
            </div>
        </div>
    );
}
