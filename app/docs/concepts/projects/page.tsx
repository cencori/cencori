import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function ProjectsPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Projects
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Organize your AI applications with projects. Manage API keys, configure settings, and collaborate with your team.
                </p>
            </div>

            {/* What are Projects */}
            <div className="space-y-4">
                <h2 id="what-are-projects" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    What are Projects?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Projects are the primary way to organize your AI applications in Cencori. Each project has its own API keys, security policies, rate limits, and usage analytics. This allows you to keep different applications or environments completely separate.
                </p>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">
                        <strong>Isolation:</strong> Each project has its own API keys and configuration
                    </li>
                    <li className="list-disc">
                        <strong>Organization:</strong> Group related AI features into a single project
                    </li>
                    <li className="list-disc">
                        <strong>Analytics:</strong> Track usage and costs per project
                    </li>
                    <li className="list-disc">
                        <strong>Collaboration:</strong> Invite team members to specific projects
                    </li>
                </ul>
            </div>

            {/* Creating Projects */}
            <div className="space-y-4">
                <h2 id="creating-projects" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Creating Projects
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Create a new project from the Cencori dashboard in just a few steps:
                </p>

                <div className="space-y-3 mt-6">
                    <h3 className="text-base font-semibold">Step-by-Step Guide</h3>
                    <ol className="space-y-2 text-sm ml-6 list-decimal">
                        <li>Log in to your <a href="/dashboard" className="text-primary hover:underline">Cencori dashboard</a></li>
                        <li>Click the <strong>&quot;Create Project&quot;</strong> button in the top navigation</li>
                        <li>Enter a descriptive project name (e.g., &quot;Production App&quot;, &quot;Development&quot;)</li>
                        <li>Optionally add a description to help identify the project&apos;s purpose</li>
                        <li>Select your organization (if you belong to multiple)</li>
                        <li>Click <strong>&quot;Create&quot;</strong> to finish</li>
                    </ol>
                </div>

                <div className="mt-4 p-4 bg-muted/20 border border-border/40">
                    <p className="text-xs text-muted-foreground">
                        <strong>Tip:</strong> Create separate projects for development, staging, and production environments to keep your data and metrics isolated.
                    </p>
                </div>
            </div>

            {/* API Key Management */}
            <div className="space-y-4">
                <h2 id="api-keys" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    API Key Management
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    API keys authenticate your application with Cencori. Each project can have multiple API keys for different purposes.
                </p>

                <div className="space-y-6 mt-6">
                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Generating API Keys</h3>
                        <ol className="space-y-2 text-sm ml-6 list-decimal">
                            <li>Navigate to your project in the dashboard</li>
                            <li>Go to the <strong>&quot;API Keys&quot;</strong> tab</li>
                            <li>Click <strong>&quot;Generate New Key&quot;</strong></li>
                            <li>Give your key a descriptive name (e.g., &quot;Production Server&quot;, &quot;Mobile App&quot;)</li>
                            <li>Copy the key immediately - it won&apos;t be shown again for security</li>
                        </ol>
                        <CodeBlock
                            filename=".env"
                            language="bash"
                            code={`# Store your API key securely
CENCORI_API_KEY=cen_prod_abc123xyz456`}
                        />
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Key Naming Best Practices</h3>
                        <ul className="space-y-2 text-sm ml-6">
                            <li className="list-disc">Use descriptive names that indicate where the key is used</li>
                            <li className="list-disc">Include the environment (e.g., &quot;Production Web Server&quot;)</li>
                            <li className="list-disc">Date the key if you plan to rotate regularly (e.g., &quot;API Key - Jan 2025&quot;)</li>
                            <li className="list-disc">Avoid generic names like &quot;Key 1&quot; or &quot;Test Key&quot;</li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Revoking API Keys</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            If a key is compromised or no longer needed, you can revoke it immediately from the dashboard. Revoked keys cannot be used to make requests.
                        </p>
                        <CodeBlock
                            filename="example-error.txt"
                            language="text"
                            code={`Error: Invalid API key
Status: 401 Unauthorized
Message: The provided API key has been revoked or does not exist.`}
                        />
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Key Rotation</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            For enhanced security, rotate your API keys regularly:
                        </p>
                        <ol className="space-y-2 text-sm ml-6 list-decimal">
                            <li>Generate a new API key in the dashboard</li>
                            <li>Update your application to use the new key</li>
                            <li>Deploy the changes</li>
                            <li>Verify the new key is working</li>
                            <li>Revoke the old key</li>
                        </ol>
                    </div>
                </div>
            </div>

            {/* Environment Separation */}
            <div className="space-y-4">
                <h2 id="environments" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Environment Separation
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Cencori supports test and production environments within each project, allowing you to develop and test safely without affecting production data.
                </p>

                <div className="space-y-3 mt-6">
                    <h3 className="text-base font-semibold">Test vs Production Keys</h3>
                    <ul className="space-y-2 text-sm ml-6">
                        <li className="list-disc">
                            <strong>Production keys</strong> start with <code className="text-xs bg-muted px-1.5 py-0.5 rounded">cen</code> - use these in live applications
                        </li>
                        <li className="list-disc">
                            <strong>Test keys</strong> start with <code className="text-xs bg-muted px-1.5 py-0.5 rounded">cen_test_</code> - use these during development
                        </li>
                    </ul>
                </div>

                <div className="space-y-3 mt-6">
                    <h3 className="text-base font-semibold">Environment Configuration</h3>
                    <CodeBlock
                        filename=".env.development"
                        language="bash"
                        code={`# Development environment
CENCORI_API_KEY=cen_test_abc123xyz456`}
                    />
                    <CodeBlock
                        filename=".env.production"
                        language="bash"
                        code={`# Production environment
CENCORI_API_KEY=cen_xyz789abc123`}
                    />
                </div>

                <div className="mt-4 p-4 bg-muted/20 border border-border/40">
                    <p className="text-xs text-muted-foreground">
                        <strong>Best Practice:</strong> Test keys have lower rate limits and don&apos;t incur charges, making them perfect for development and testing.
                    </p>
                </div>
            </div>

            {/* Team Collaboration */}
            <div className="space-y-4">
                <h2 id="team-collaboration" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Team Collaboration
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Invite team members to collaborate on projects with role-based access control.
                </p>

                <div className="space-y-3 mt-6">
                    <h3 className="text-base font-semibold">Team Roles</h3>
                    <ul className="space-y-2 text-sm ml-6">
                        <li className="list-disc">
                            <strong>Owner:</strong> Full access including project deletion and billing
                        </li>
                        <li className="list-disc">
                            <strong>Admin:</strong> Can manage settings, keys, and team members
                        </li>
                        <li className="list-disc">
                            <strong>Developer:</strong> Can view logs and analytics, generate API keys
                        </li>
                        <li className="list-disc">
                            <strong>Viewer:</strong> Read-only access to logs and analytics
                        </li>
                    </ul>
                </div>

                <div className="space-y-3 mt-6">
                    <h3 className="text-base font-semibold">Inviting Team Members</h3>
                    <ol className="space-y-2 text-sm ml-6 list-decimal">
                        <li>Go to the <strong>&quot;Team&quot;</strong> tab in your project</li>
                        <li>Click <strong>&quot;Invite Member&quot;</strong></li>
                        <li>Enter their email address</li>
                        <li>Select their role</li>
                        <li>Click <strong>&quot;Send Invitation&quot;</strong></li>
                    </ol>
                </div>
            </div>

            {/* Project Settings */}
            <div className="space-y-4">
                <h2 id="settings" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Project Settings
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Configure various settings to control how your project operates.
                </p>

                <div className="space-y-6 mt-6">
                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Rate Limits</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Set request limits to prevent abuse and control costs:
                        </p>
                        <ul className="space-y-2 text-sm ml-6">
                            <li className="list-disc">Requests per minute/hour/day</li>
                            <li className="list-disc">Token usage limits</li>
                            <li className="list-disc">Per-user limits (if using user identification)</li>
                            <li className="list-disc">Budget caps and spending alerts</li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Security Policies</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Configure project-wide security settings:
                        </p>
                        <ul className="space-y-2 text-sm ml-6">
                            <li className="list-disc">Enable/disable PII filtering</li>
                            <li className="list-disc">Set content moderation thresholds</li>
                            <li className="list-disc">Configure custom security rules</li>
                            <li className="list-disc">Whitelist/blacklist specific patterns</li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Provider Configuration</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Add and manage AI provider API keys:
                        </p>
                        <ul className="space-y-2 text-sm ml-6">
                            <li className="list-disc">OpenAI API key</li>
                            <li className="list-disc">Anthropic API key</li>
                            <li className="list-disc">Google AI API key</li>
                            <li className="list-disc">Custom endpoint configurations</li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Integrations</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Connect your project to external tools:
                        </p>
                        <ul className="space-y-2 text-sm ml-6">
                            <li className="list-disc">Slack notifications for security incidents</li>
                            <li className="list-disc">Webhook endpoints for real-time events</li>
                            <li className="list-disc">Data warehouse exports (Snowflake, BigQuery)</li>
                            <li className="list-disc">Monitoring tools (Datadog, Prometheus)</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Deleting Projects */}
            <div className="space-y-4">
                <h2 id="deleting-projects" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Deleting Projects
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    If you no longer need a project, you can delete it from the project settings. This action is irreversible and will:
                </p>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">Revoke all API keys associated with the project</li>
                    <li className="list-disc">Delete all logs and analytics data</li>
                    <li className="list-disc">Remove all team member access</li>
                    <li className="list-disc">Cancel any active integrations</li>
                </ul>

                <div className="mt-4 p-4 bg-destructive/10 border border-destructive/40">
                    <p className="text-xs text-destructive">
                        <strong>Warning:</strong> Project deletion is permanent and cannot be undone. Export any important data before deleting a project.
                    </p>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/concepts/security">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Security</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/api/auth">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Authentication</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
