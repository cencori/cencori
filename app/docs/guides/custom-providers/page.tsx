import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function CustomProvidersPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Custom Providers
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Connect Cencori to your own AI models or proxy services while maintaining full security and observability.
                </p>
            </div>

            {/* What are Custom Providers */}
            <div className="space-y-4">
                <h2 id="what-are-custom-providers" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    What are Custom Providers?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Custom providers allow you to add your own AI model endpoints to Cencori. This is useful if you:
                </p>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">Self-host open-source models (Llama, Mistral)</li>
                    <li className="list-disc">Use Azure OpenAI Service with your own deployment</li>
                    <li className="list-disc">Have a custom AI gateway or proxy</li>
                    <li className="list-disc">Want unified observability across all AI vendors</li>
                </ul>
            </div>

            {/* Supported Formats */}
            <div className="space-y-4">
                <h2 id="supported-formats" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Supported API Formats
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Cencori supports providers that use:
                </p>
                <ul className="space-y-2 text-sm ml-6 mt-3">
                    <li className="list-disc"><strong>OpenAI API format</strong> - Most common (vLLM, Ollama, Azure OpenAI)</li>
                    <li className="list-disc"><strong>Anthropic API format</strong> - Claude-compatible endpoints</li>
                </ul>
            </div>

            {/* Adding a Custom Provider */}
            <div className="space-y-4">
                <h2 id="adding-provider" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Adding a Custom Provider
                </h2>

                <div className="space-y-3 mt-4">
                    <h3 className="text-base font-semibold">Via Dashboard:</h3>
                    <ol className="space-y-2 text-sm ml-6 list-decimal">
                        <li>Go to your organization settings</li>
                        <li>Click &quot;Custom Providers&quot; in the sidebar</li>
                        <li>Click &quot;Add Custom Provider&quot;</li>
                        <li>Fill in the provider details:</li>
                    </ol>

                    <div className="ml-12 space-y-2 text-sm mt-2">
                        <p><strong>Name:</strong> Friendly name (e.g., &quot;Azure GPT-4&quot;)</p>
                        <p><strong>Base URL:</strong> Your endpoint (e.g., <code className="text-xs bg-muted px-1.5 py-0.5 rounded">https://your-api.openai.azure.com</code>)</p>
                        <p><strong>API Key:</strong> Your provider&apos;s API key</p>
                        <p><strong>Format:</strong> OpenAI or Anthropic</p>
                    </div>

                    <ol start={5} className="space-y-2 text-sm ml-6 list-decimal mt-3">
                        <li>Click &quot;Test Connection&quot; to verify</li>
                        <li>Click &quot;Add Provider&quot; to save</li>
                    </ol>
                </div>
            </div>

            {/* Example: Azure OpenAI */}
            <div className="space-y-4">
                <h2 id="example-azure" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Example: Azure Open AI Service
                </h2>

                <CodeBlock
                    filename="azure-setup"
                    language="text"
                    code={`Name: Azure GPT-4
Base URL: https://your-resource.openai.azure.com
API Key: your-azure-api-key
Format: OpenAI

Model Name (in Cencori): azure-gpt-4
Deployment Name (in Azure): gpt-4-deployment`}
                />

                <p className="text-sm text-muted-foreground mt-4">
                    After adding, use it in your code:
                </p>

                <CodeBlock
                    filename="use-azure.ts"
                    language="typescript"
                    code={`const response = await cencori.ai.chat({
  model: 'azure-gpt-4', // Your custom provider model name
  messages: [{ role: 'user', content: 'Hello!' }],
});`}
                />
            </div>

            {/* Example: vLLM/Ollama */}
            <div className="space-y-4">
                <h2 id="example-vllm" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Example: Self-Hosted Model (vLLM/Ollama)
                </h2>

                <CodeBlock
                    filename="vllm-setup"
                    language="text"
                    code={`Name: Self-Hosted Llama
Base URL: https://your-vllm-endpoint.com/v1
API Key: (leave empty if not required)
Format: OpenAI

Model Name: llama-3-70b`}
                />

                <CodeBlock
                    filename="use-vllm.ts"
                    language="typescript"
                    code={`const response = await cencori.ai.chat({
  model: 'llama-3-70b',
  messages: [{ role: 'user', content: 'Hello!' }],
});`}
                />
            </div>

            {/* Security and API Keys */}
            <div className="space-y-4">
                <h2 id="security" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Security: API Key Storage
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    When you add a custom provider, Cencori securely stores your API key:
                </p>
                <ul className="space-y-2 text-sm ml-6 mt-3">
                    <li className="list-disc">Encrypted at rest in our database</li>
                    <li className="list-disc">Never exposed in  logs or responses</li>
                    <li className="list-disc">Only used to proxy requests to your endpoint</li>
                    <li className="list-disc">Can be rotated or removed at any time</li>
                </ul>
            </div>

            {/* Benefits */}
            <div className="space-y-4">
                <h2 id="benefits" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Benefits of Custom Providers
                </h2>

                <div className="space-y-4">
                    <div>
                        <h3 className="text-base font-semibold mb-2">Unified Observability</h3>
                        <p className="text-sm text-muted-foreground">
                            View usage, costs, and security incidents for all providers in one dashboard—whether it&apos;s OpenAI, Anthropic, or your self-hosted model.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Security Everywhere</h3>
                        <p className="text-sm text-muted-foreground">
                            Cencori&apos;s PII detection, prompt injection protection, and content filtering work with custom providers too.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Cost Tracking</h3>
                        <p className="text-sm text-muted-foreground">
                            Track token usage and compute costs across all providers, including your own infrastructure.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Seamless Migration</h3>
                        <p className="text-sm text-muted-foreground">
                            Easily switch between providers by just changing the model name—no code changes required.
                        </p>
                    </div>
                </div>
            </div>

            {/* Troubleshooting */}
            <div className="space-y-4">
                <h2 id="troubleshooting" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Troubleshooting
                </h2>

                <div className="space-y-4">
                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">Connection Test Failed</h3>
                        <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                            <li className="list-disc">Verify the Base URL is correct and accessible</li>
                            <li className="list-disc">Check that the API key is valid</li>
                            <li className="list-disc">Ensure the endpoint supports OpenAI or Anthropic format</li>
                            <li className="list-disc">Check firewall rules allow Cencori&apos;s IP addresses</li>
                        </ul>
                    </div>

                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">Model Not Found Error</h3>
                        <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                            <li className="list-disc">Ensure the model name matches exactly</li>
                            <li className="list-disc">For Azure, use the deployment name, not the model name</li>
                            <li className="list-disc">Check that the model is available on your endpoint</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/concepts/organizations">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Organizations</span>
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
