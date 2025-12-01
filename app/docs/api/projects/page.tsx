import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function ProjectsAPIPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-20">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Projects API
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Complete API reference for managing projects programmatically via REST endpoints.
                </p>
            </div>

            {/* Overview */}
            <div className="space-y-4">
                <h2 id="overview" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Overview
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Projects API allows you to create, update, and manage projects programmatically. All endpoints require authentication via API key.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Base URL: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">https://cencori.com/api</code>
                </p>
            </div>

            {/* List Projects */}
            <div className="space-y-4">
                <h2 id="list-projects" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    List Projects
                </h2>
                <p className="text-sm text-muted-foreground">
                    Get all projects in your organization.
                </p>

                <div className="space-y-4">
                    <div>
                        <h3 className="text-base font-semibold mb-2">Request</h3>
                        <CodeBlock
                            filename="request"
                            language="bash"
                            code={`GET /api/organizations/{orgSlug}/projects

Headers:
  CENCORI_API_KEY: your_api_key`}
                        />
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Response</h3>
                        <CodeBlock
                            filename="response.json"
                            language="json"
                            code={`{
  "projects": [
    {
      "id": "proj_123",
      "name": "Production API",
      "slug": "production-api",
      "description": "Main production application",
      "status": "active",
      "visibility": "public",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-15T00:00:00Z"
    }
  ]
}`}
                        />
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Example</h3>
                        <CodeBlock
                            filename="list-projects.ts"
                            language="typescript"
                            code={`const response = await fetch(
  'https://cencori.com/api/organizations/my-org/projects',
  {
    headers: {
      'CENCORI_API_KEY': process.env.CENCORI_API_KEY!,
    },
  }
);

const { projects } = await response.json();
console.log(\`Found \${projects.length} projects\`);`}
                        />
                    </div>
                </div>
            </div>

            {/* Create Project */}
            <div className="space-y-4">
                <h2 id="create-project" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Create Project
                </h2>
                <p className="text-sm text-muted-foreground">
                    Create a new project in your organization.
                </p>

                <div className="space-y-4">
                    <div>
                        <h3 className="text-base font-semibold mb-2">Request</h3>
                        <CodeBlock
                            filename="request"
                            language="bash"
                            code={`POST /api/organizations/{orgSlug}/projects

Headers:
  CENCORI_API_KEY: your_api_key
  Content-Type: application/json

Body:
{
  "name": "My New Project",
  "description": "Optional description",
  "visibility": "public" | "private"
}`}
                        />
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Parameters</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left p-3 font-semibold">Field</th>
                                        <th className="text-left p-3 font-semibold">Type</th>
                                        <th className="text-left p-3 font-semibold">Required</th>
                                        <th className="text-left p-3 font-semibold">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="text-muted-foreground">
                                    <tr className="border-b">
                                        <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">name</code></td>
                                        <td className="p-3">string</td>
                                        <td className="p-3">✅</td>
                                        <td className="p-3">Project name</td>
                                    </tr>
                                    <tr className="border-b">
                                        <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">description</code></td>
                                        <td className="p-3">string</td>
                                        <td className="p-3">❌</td>
                                        <td className="p-3">Project description</td>
                                    </tr>
                                    <tr className="border-b">
                                        <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">visibility</code></td>
                                        <td className="p-3">string</td>
                                        <td className="p-3">❌</td>
                                        <td className="p-3">public or private (default: public)</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Example</h3>
                        <CodeBlock
                            filename="create-project.ts"
                            language="typescript"
                            code={`const response = await fetch(
  'https://cencori.com/api/organizations/my-org/projects',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CENCORI_API_KEY': process.env.CENCORI_API_KEY!,
    },
    body: JSON.stringify({
      name: 'My New Project',
      description: 'AI chatbot for customer support',
      visibility: 'public',
    }),
  }
);

const project = await response.json();
console.log('Created project:', project.id);`}
                        />
                    </div>
                </div>
            </div>

            {/* Get Project */}
            <div className="space-y-4">
                <h2 id="get-project" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Get Project
                </h2>
                <p className="text-sm text-muted-foreground">
                    Retrieve details for a specific project.
                </p>

                <div className="space-y-4">
                    <div>
                        <h3 className="text-base font-semibold mb-2">Request</h3>
                        <CodeBlock
                            filename="request"
                            language="bash"
                            code={`GET /api/organizations/{orgSlug}/projects/{projectSlug}

Headers:
  CENCORI_API_KEY: your_api_key`}
                        />
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Response</h3>
                        <CodeBlock
                            filename="response.json"
                            language="json"
                            code={`{
  "id": "proj_123",
  "name": "Production API",
  "slug": "production-api",
  "description": "Main production application",
  "status": "active",
  "visibility": "public",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-15T00:00:00Z",
  "stats": {
    "total_requests": 15420,
    "total_cost_usd": 125.50
  }
}`}
                        />
                    </div>
                </div>
            </div>

            {/* Update Project */}
            <div className="space-y-4">
                <h2 id="update-project" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Update Project
                </h2>
                <p className="text-sm text-muted-foreground">
                    Update an existing project.
                </p>

                <div className="space-y-4">
                    <div>
                        <h3 className="text-base font-semibold mb-2">Request</h3>
                        <CodeBlock
                            filename="request"
                            language="bash"
                            code={`PATCH /api/organizations/{orgSlug}/projects/{projectSlug}

Headers:
  CENCORI_API_KEY: your_api_key
  Content-Type: application/json

Body:
{
  "name": "Updated Name",
  "description": "Updated description",
  "visibility": "private"
}`}
                        />
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Example</h3>
                        <CodeBlock
                            filename="update-project.ts"
                            language="typescript"
                            code={`const response = await fetch(
  'https://cencori.com/api/organizations/my-org/projects/my-project',
  {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'CENCORI_API_KEY': process.env.CENCORI_API_KEY!,
    },
    body: JSON.stringify({
      name: 'Production API v2',
      description: 'Updated production API',
    }),
  }
);

const updated = await response.json();
console.log('Updated:', updated.name);`}
                        />
                    </div>
                </div>
            </div>

            {/* Delete Project */}
            <div className="space-y-4">
                <h2 id="delete-project" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Delete Project
                </h2>
                <p className="text-sm text-muted-foreground">
                    Permanently delete a project and all associated data.
                </p>

                <div className="space-y-4">
                    <div>
                        <h3 className="text-base font-semibold mb-2">Request</h3>
                        <CodeBlock
                            filename="request"
                            language="bash"
                            code={`DELETE /api/organizations/{orgSlug}/projects/{projectSlug}

Headers:
  CENCORI_API_KEY: your_api_key`}
                        />
                    </div>

                    <div className="mt-4 p-4 bg-muted/20 border border-border/40">
                        <p className="text-xs text-muted-foreground">
                            <strong>Warning:</strong> This action is irreversible. All API keys, logs, and analytics for this project will be permanently deleted.
                        </p>
                    </div>
                </div>
            </div>

            {/* Error Responses */}
            <div className="space-y-4">
                <h2 id="errors" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Error Responses
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Status</th>
                                <th className="text-left p-3 font-semibold">Error</th>
                                <th className="text-left p-3 font-semibold">Description</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3">400</td>
                                <td className="p-3">Invalid Request</td>
                                <td className="p-3">Missing or invalid parameters</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">401</td>
                                <td className="p-3">Unauthorized</td>
                                <td className="p-3">Invalid API key</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">403</td>
                                <td className="p-3">Forbidden</td>
                                <td className="p-3">No permission to access project</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">404</td>
                                <td className="p-3">Not Found</td>
                                <td className="p-3">Project doesn&apos;t exist</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">409</td>
                                <td className="p-3">Conflict</td>
                                <td className="p-3">Project with same name exists</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/api/chat">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Chat API</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/api/keys">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">API Keys API</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
