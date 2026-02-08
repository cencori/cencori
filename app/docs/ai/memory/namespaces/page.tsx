"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock, CodeBlockCopyButton } from "@/components/ai-elements/code-block";

export default function NamespacesDocs() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Namespaces
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Organize memories into isolated collections. Use namespaces to separate data by project, user, topic, or environment.
                </p>
            </div>

            {/* What Are Namespaces */}
            <div className="space-y-4">
                <h2 id="what" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    What Are Namespaces?
                </h2>
                <p className="text-sm text-muted-foreground">
                    Namespaces are isolated containers for your memories. Data in one namespace is completely separate from another – perfect for multi-tenant apps or organizing knowledge.
                </p>
            </div>

            {/* Usage */}
            <div className="space-y-4">
                <h2 id="usage" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Usage
                </h2>

                <CodeBlock code={`// Store to a namespace
await cencori.memory.store({
  namespace: 'user-123',
  content: 'User preferences and history...'
});

// Search within a namespace
const results = await cencori.memory.search({
  namespace: 'user-123',
  query: 'preferences'
});

// List all namespaces
const namespaces = await cencori.memory.listNamespaces();
// ['default', 'user-123', 'docs', 'support']`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Common Patterns */}
            <div className="space-y-4">
                <h2 id="patterns" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Common Patterns
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 font-semibold">Pattern</th>
                                <th className="text-left py-2 font-semibold">Namespace Example</th>
                                <th className="text-left py-2 font-semibold">Use Case</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="py-2">Per-User</td>
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">user-{'{userId}'}</code></td>
                                <td className="py-2">Personalized AI, chat history</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">Per-Tenant</td>
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">org-{'{orgId}'}</code></td>
                                <td className="py-2">Multi-tenant SaaS</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">Per-Topic</td>
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">docs</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">faq</code></td>
                                <td className="py-2">Knowledge organization</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">Per-Environment</td>
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">prod</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">staging</code></td>
                                <td className="py-2">Development isolation</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Naming Rules */}
            <div className="space-y-4">
                <h2 id="naming" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Naming Rules
                </h2>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">Lowercase letters, numbers, hyphens, underscores</li>
                    <li className="list-disc">1-64 characters</li>
                    <li className="list-disc">Must start with a letter</li>
                    <li className="list-disc">No spaces or special characters</li>
                </ul>

                <CodeBlock code={`// Valid
'docs', 'user-123', 'my_project', 'prod-v2'

// Invalid
'My Docs', '123-start', 'special@chars'`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Dashboard */}
            <div className="space-y-4">
                <h2 id="dashboard" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Dashboard
                </h2>
                <p className="text-sm text-muted-foreground">
                    Create and manage namespaces in the dashboard: <strong>Memory → Namespaces</strong>
                </p>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/ai/memory">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">AI Memory</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/ai/memory/store-search">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Store &amp; Search</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
