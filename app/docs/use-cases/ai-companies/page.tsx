import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function AICompaniesPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    For AI-Integrated Companies
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    You&apos;ve integrated AI into your core product. Now you need enterprise-grade control.
                </p>
            </div>

            {/* The Challenge */}
            <div className="space-y-4">
                <h2 id="the-challenge" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    The Enterprise AI Challenge
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    When AI becomes a feature of your B2B product, your customers demand the same security guarantees they expect from the rest of your stack.
                </p>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">
                        <strong>Data Sovereignty:</strong> Where is the data going? Is it being logged?
                    </li>
                    <li className="list-disc">
                        <strong>Cost Control:</strong> How do you prevent a single tenant from draining your LLM budget?
                    </li>
                    <li className="list-disc">
                        <strong>Compliance:</strong> Can you produce an audit trail of every AI interaction?
                    </li>
                    <li className="list-disc">
                        <strong>Reliability:</strong> What happens when OpenAI is down?
                    </li>
                </ul>
            </div>

            {/* Enterprise Features */}
            <div className="space-y-4">
                <h2 id="enterprise-features" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Enterprise-Grade Infrastructure
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Cencori provides the missing infrastructure layer for your AI features.
                </p>

                <div className="space-y-6 mt-6">
                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Multi-Tenancy & Rate Limiting</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Assign quotas and rate limits per customer (tenant) to ensure fair usage and cost predictability.
                        </p>
                        <CodeBlock
                            filename="middleware/ai-limiter.ts"
                            language="typescript"
                            code={`// Enforce limits per tenant
await cencori.limits.enforce({
  tenantId: user.organizationId,
  feature: "ai-summary",
  limit: 1000, // requests per month
  period: "monthly"
});`}
                        />
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Immutable Audit Logs</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Every prompt and completion is logged securely. You can export these logs for compliance or debugging without building your own logging infrastructure.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Policy Enforcement</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Define global policies (e.g., &quot;No PII in prompts&quot;, &quot;Block jailbreak attempts&quot;) and enforce them across all your AI features instantly.
                        </p>
                    </div>
                </div>
            </div>

            {/* Key Benefits */}
            <div className="space-y-4">
                <h2 id="benefits" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Key Benefits
                </h2>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">
                        <strong>Cost Attribution:</strong> Track AI usage and costs per customer, feature, or team
                    </li>
                    <li className="list-disc">
                        <strong>Multi-Provider Support:</strong> Switch between OpenAI, Anthropic, and Google without code changes
                    </li>
                    <li className="list-disc">
                        <strong>Security Policies:</strong> Centralized control over PII filtering, content moderation, and threat detection
                    </li>
                    <li className="list-disc">
                        <strong>Compliance Ready:</strong> SOC 2, GDPR, and HIPAA-compliant audit trails out of the box
                    </li>
                    <li className="list-disc">
                        <strong>Observability:</strong> Real-time dashboards for usage, costs, latency, and security incidents
                    </li>
                </ul>
            </div>

            {/* Integration */}
            <div className="space-y-4">
                <h2 id="integration" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Seamless Integration
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Cencori integrates with your existing observability stack (Datadog, Prometheus) and identity providers. It&apos;s designed to be the invisible, reliable backbone of your AI operations.
                </p>
                <ul className="space-y-2 text-sm ml-6 mt-4">
                    <li className="list-disc">Works with your existing auth system (OAuth, SAML)</li>
                    <li className="list-disc">Export logs to your data warehouse (Snowflake, BigQuery)</li>
                    <li className="list-disc">Integrate with compliance tools (Vanta, Drata)</li>
                    <li className="list-disc">API-first design for custom integrations</li>
                </ul>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/use-cases/vibe-coders">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">For Context Engineers</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/concepts/security">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Security</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
