import Link from "next/link";
import { ChevronLeft, ChevronRight, Code2, Terminal, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { Badge } from "@/components/ui/badge";
import { VercelLogo, SupabaseLogo, VSCodeLogo, CursorLogo } from "@/components/icons/BrandIcons";

export default function IntegrationsPage() {
  return (
    <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
            Integrations
          </h1>
          <Badge variant="outline" className="text-xs">Edge</Badge>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          Comprehensive guide to integrating Cencori Edge with your platforms, edge runtimes, and development tools. Deploy AI protection across your entire stack with minimal configuration.
        </p>
      </div>

      {/* Overview */}
      <div className="space-y-4">
        <h2 id="overview" className="scroll-m-20 text-xl font-semibold tracking-tight">
          Overview
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Cencori Edge provides pre-built integrations that allow you to add AI request protection at the edge layer of your application. Instead of modifying your application code, Edge integrations intercept requests at the infrastructure level, providing:
        </p>
        <ul className="space-y-2 text-sm ml-6">
          <li className="list-disc"><strong>Zero-code protection:</strong> Add security without changing your application</li>
          <li className="list-disc"><strong>Minimal latency:</strong> Edge processing adds &lt;50ms to request time</li>
          <li className="list-disc"><strong>Automatic scaling:</strong> Protection scales with your edge infrastructure</li>
          <li className="list-disc"><strong>Real-time filtering:</strong> Block malicious requests before they reach your AI providers</li>
        </ul>
      </div>

      {/* Supported Integrations */}
      <div className="space-y-4">
        <h2 id="supported-integrations" className="scroll-m-20 text-xl font-semibold tracking-tight">
          Supported Integrations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border border-border/40 rounded-lg">
            <VercelLogo className="h-5 w-5 mb-2" />
            <h3 className="font-semibold text-sm">Vercel</h3>
            <p className="text-xs text-muted-foreground mt-1">Edge Middleware & Marketplace</p>
          </div>
          <div className="p-4 border border-border/40 rounded-lg">
            <SupabaseLogo className="h-5 w-5 mb-2" />
            <h3 className="font-semibold text-sm">Supabase</h3>
            <p className="text-xs text-muted-foreground mt-1">Edge Functions Extension</p>
          </div>
          <div className="p-4 border border-border/40 rounded-lg">
            <Code2 className="h-5 w-5 mb-2 text-muted-foreground" />
            <h3 className="font-semibold text-sm">IDE Plugins</h3>
            <p className="text-xs text-muted-foreground mt-1">Cursor & VS Code</p>
          </div>
        </div>
      </div>

      {/* ==================== VERCEL SECTION ==================== */}
      <div className="space-y-6 pt-8 border-t border-border/40">
        <div className="flex items-center gap-3">
          <VercelLogo className="h-6 w-6" />
          <h2 id="vercel" className="scroll-m-20 text-2xl font-bold tracking-tight">
            Vercel Integration
          </h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The Vercel integration allows you to protect all AI requests in your Next.js, SvelteKit, Nuxt, or any Vercel-hosted application using Edge Middleware. Requests are intercepted and processed before reaching your application.
        </p>

        {/* Vercel - Installation Methods */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Installation Methods</h3>

          <div className="space-y-3">
            <h4 className="text-base font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs">1</span>
              Vercel Marketplace (Recommended)
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The easiest way to integrate Cencori with your Vercel projects is through the Vercel Marketplace:
            </p>
            <ol className="space-y-2 text-sm ml-6">
              <li className="list-decimal">Navigate to the <a href="https://vercel.com/integrations" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Vercel Integrations Marketplace</a></li>
              <li className="list-decimal">Search for &quot;Cencori&quot; and click &quot;Add Integration&quot;</li>
              <li className="list-decimal">Select the projects you want to protect</li>
              <li className="list-decimal">Authorize the integration with your Cencori account</li>
              <li className="list-decimal">The integration will automatically configure your projects</li>
            </ol>
            <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-xs text-muted-foreground flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>Marketplace installation automatically handles environment variables, middleware setup, and preview deploy protection.</span>
              </p>
            </div>
          </div>

          <div className="space-y-3 mt-6">
            <h4 className="text-base font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs">2</span>
              Manual Edge Middleware Setup
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              For more control, you can manually configure the Edge Middleware in your project:
            </p>

            <p className="text-sm font-medium mt-4">Step 1: Install the package</p>
            <CodeBlock
              filename="terminal"
              language="bash"
              code={`npm install @cencori/edge`}
            />

            <p className="text-sm font-medium mt-4">Step 2: Add environment variables</p>
            <CodeBlock
              filename=".env.local"
              language="bash"
              code={`# Cencori Edge Configuration
CENCORI_API_KEY=cen_your_api_key_here
CENCORI_PROJECT_ID=your_project_id

# Optional: Custom endpoint (defaults to production)
# CENCORI_EDGE_URL=https://edge.cencori.com`}
            />

            <p className="text-sm font-medium mt-4">Step 3: Create the middleware file</p>
            <CodeBlock
              filename="middleware.ts"
              language="typescript"
              code={`import { createCencoriMiddleware } from "@cencori/edge";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Create the Cencori middleware
const cencoriMiddleware = createCencoriMiddleware({
  apiKey: process.env.CENCORI_API_KEY!,
  projectId: process.env.CENCORI_PROJECT_ID!,
  
  // Routes to protect (glob patterns)
  protectedRoutes: [
    "/api/ai/*",
    "/api/chat/*",
    "/api/completions/*",
  ],
  
  // Optional: Security settings
  security: {
    piiDetection: true,
    promptInjection: true,
    contentFiltering: true,
  },
  
  // Optional: Custom block response
  onBlock: (request, reason) => {
    return NextResponse.json(
      { error: "Request blocked", reason },
      { status: 403 }
    );
  },
});

export async function middleware(request: NextRequest) {
  // Apply Cencori protection
  const result = await cencoriMiddleware(request);
  if (result) return result;
  
  // Continue to your application
  return NextResponse.next();
}

// Configure middleware matcher
export const config = {
  matcher: [
    "/api/:path*",
    // Add other paths as needed
  ],
};`}
            />

            <p className="text-sm font-medium mt-4">Step 4: Configure route matching</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The middleware matcher determines which routes are processed. Common patterns:
            </p>
            <CodeBlock
              filename="middleware.ts"
              language="typescript"
              code={`export const config = {
  matcher: [
    // All API routes
    "/api/:path*",
    
    // Specific AI endpoints only
    "/api/ai/:path*",
    "/api/chat/:path*",
    
    // Exclude static files and internal routes
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};`}
            />
          </div>
        </div>

        {/* Vercel - Preview Deploy Protection */}
        <div className="space-y-4 mt-8">
          <h3 className="text-lg font-semibold">Preview Deploy Protection</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Cencori automatically protects Vercel preview deployments, preventing sensitive data from being exposed in development/staging environments:
          </p>
          <CodeBlock
            filename="middleware.ts"
            language="typescript"
            code={`import { createCencoriMiddleware } from "@cencori/edge";

const cencoriMiddleware = createCencoriMiddleware({
  apiKey: process.env.CENCORI_API_KEY!,
  projectId: process.env.CENCORI_PROJECT_ID!,
  
  // Enhanced protection for preview deploys
  previewProtection: {
    enabled: true,
    
    // Require authentication for AI endpoints on previews
    requireAuth: true,
    
    // Rate limit preview environments more aggressively
    rateLimit: {
      requests: 100,
      window: "1h",
    },
    
    // Log all requests for debugging
    verbose: true,
  },
});`}
          />
        </div>

        {/* Vercel - Configuration Options */}
        <div className="space-y-4 mt-8">
          <h3 className="text-lg font-semibold">Configuration Options</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left py-2 font-semibold">Option</th>
                  <th className="text-left py-2 font-semibold">Type</th>
                  <th className="text-left py-2 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/20">
                  <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">apiKey</code></td>
                  <td className="py-2">string</td>
                  <td className="py-2">Your Cencori API key (required)</td>
                </tr>
                <tr className="border-b border-border/20">
                  <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">projectId</code></td>
                  <td className="py-2">string</td>
                  <td className="py-2">Your Cencori project ID (required)</td>
                </tr>
                <tr className="border-b border-border/20">
                  <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">protectedRoutes</code></td>
                  <td className="py-2">string[]</td>
                  <td className="py-2">Glob patterns for routes to protect</td>
                </tr>
                <tr className="border-b border-border/20">
                  <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">security</code></td>
                  <td className="py-2">object</td>
                  <td className="py-2">Enable/disable security features</td>
                </tr>
                <tr className="border-b border-border/20">
                  <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">onBlock</code></td>
                  <td className="py-2">function</td>
                  <td className="py-2">Custom handler for blocked requests</td>
                </tr>
                <tr className="border-b border-border/20">
                  <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">previewProtection</code></td>
                  <td className="py-2">object</td>
                  <td className="py-2">Settings for Vercel preview deploys</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ==================== SUPABASE SECTION ==================== */}
      <div className="space-y-6 pt-8 border-t border-border/40">
        <div className="flex items-center gap-3">
          <SupabaseLogo className="h-6 w-6" />
          <h2 id="supabase" className="scroll-m-20 text-2xl font-bold tracking-tight">
            Supabase Integration
          </h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The Supabase integration extends Edge Functions with Cencori protection, allowing you to secure AI requests made from your Supabase backend without modifying function code.
        </p>

        {/* Supabase - Installation */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Installation</h3>

          <p className="text-sm font-medium">Step 1: Enable the Cencori extension</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            In your Supabase dashboard, navigate to Database → Extensions and search for &quot;cencori&quot;:
          </p>
          <CodeBlock
            filename="SQL Editor"
            language="sql"
            code={`-- Enable the Cencori extension
CREATE EXTENSION IF NOT EXISTS cencori;

-- Configure your API credentials
SELECT cencori.configure(
  api_key := 'cen_your_api_key_here',
  project_id := 'your_project_id'
);`}
          />

          <p className="text-sm font-medium mt-6">Step 2: Create a protected Edge Function</p>
          <CodeBlock
            filename="supabase/functions/ai-chat/index.ts"
            language="typescript"
            code={`import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createCencoriClient } from "https://esm.sh/@cencori/supabase";

const cencori = createCencoriClient({
  apiKey: Deno.env.get("CENCORI_API_KEY")!,
  projectId: Deno.env.get("CENCORI_PROJECT_ID")!,
});

serve(async (req) => {
  // Automatically inspects and protects the request
  const protectedReq = await cencori.protect(req);
  
  if (protectedReq.blocked) {
    return new Response(
      JSON.stringify({ error: protectedReq.reason }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
  
  // Your AI logic here
  const body = await protectedReq.json();
  
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${Deno.env.get("OPENAI_API_KEY")}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  
  // Protect the response before returning
  const protectedResponse = await cencori.protectResponse(response);
  
  return protectedResponse;
});`}
          />

          <p className="text-sm font-medium mt-6">Step 3: Configure environment secrets</p>
          <CodeBlock
            filename="terminal"
            language="bash"
            code={`# Add secrets using Supabase CLI
supabase secrets set CENCORI_API_KEY=cen_your_api_key_here
supabase secrets set CENCORI_PROJECT_ID=your_project_id`}
          />
        </div>

        {/* Supabase - Edge Function Routing */}
        <div className="space-y-4 mt-8">
          <h3 className="text-lg font-semibold">Edge Function Routing</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            For applications with multiple Edge Functions, you can configure global routing to protect all AI-related functions:
          </p>
          <CodeBlock
            filename="supabase/functions/_shared/cencori.ts"
            language="typescript"
            code={`import { createCencoriClient, CencoriConfig } from "https://esm.sh/@cencori/supabase";

// Shared configuration
const config: CencoriConfig = {
  apiKey: Deno.env.get("CENCORI_API_KEY")!,
  projectId: Deno.env.get("CENCORI_PROJECT_ID")!,
  
  // Security settings
  security: {
    piiDetection: {
      enabled: true,
      action: "redact", // "block" | "redact" | "warn"
    },
    promptInjection: {
      enabled: true,
      sensitivity: "medium", // "low" | "medium" | "high"
    },
    contentFiltering: {
      enabled: true,
      categories: ["hate", "violence", "sexual", "self-harm"],
    },
  },
  
  // Logging
  logging: {
    enabled: true,
    level: "info",
  },
};

export const cencori = createCencoriClient(config);

// Helper middleware function
export async function withCencori(
  req: Request,
  handler: (req: Request) => Promise<Response>
): Promise<Response> {
  const protectedReq = await cencori.protect(req);
  
  if (protectedReq.blocked) {
    return new Response(
      JSON.stringify({ 
        error: "Request blocked by security policy",
        reason: protectedReq.reason,
        requestId: protectedReq.requestId,
      }),
      { 
        status: 403, 
        headers: { "Content-Type": "application/json" } 
      }
    );
  }
  
  const response = await handler(protectedReq);
  return cencori.protectResponse(response);
}`}
          />

          <p className="text-sm font-medium mt-4">Using the shared middleware:</p>
          <CodeBlock
            filename="supabase/functions/chat/index.ts"
            language="typescript"
            code={`import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withCencori } from "../_shared/cencori.ts";

serve(async (req) => {
  return withCencori(req, async (protectedReq) => {
    // Your function logic here - request is already protected
    const body = await protectedReq.json();
    
    // Process AI request...
    
    return new Response(
      JSON.stringify({ result: "..." }),
      { headers: { "Content-Type": "application/json" } }
    );
  });
});`}
          />
        </div>

        {/* Supabase - Database Functions */}
        <div className="space-y-4 mt-8">
          <h3 className="text-lg font-semibold">Database-Level Protection</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You can also use Cencori directly in PostgreSQL functions for database-level AI protection:
          </p>
          <CodeBlock
            filename="SQL Editor"
            language="sql"
            code={`-- Create a protected AI function
CREATE OR REPLACE FUNCTION protected_ai_query(
  user_prompt TEXT,
  model TEXT DEFAULT 'gpt-3.5-turbo'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  protection_result JSONB;
  ai_response JSONB;
BEGIN
  -- Check request with Cencori
  protection_result := cencori.check_request(
    prompt := user_prompt,
    options := jsonb_build_object(
      'pii_detection', true,
      'prompt_injection', true
    )
  );
  
  -- Block if flagged
  IF protection_result->>'blocked' = 'true' THEN
    RETURN jsonb_build_object(
      'error', 'Request blocked',
      'reason', protection_result->>'reason'
    );
  END IF;
  
  -- Use the sanitized prompt
  ai_response := cencori.proxy_request(
    provider := 'openai',
    model := model,
    prompt := protection_result->>'sanitized_prompt'
  );
  
  RETURN ai_response;
END;
$$;`}
          />
        </div>
      </div>

      {/* ==================== IDE PLUGINS SECTION ==================== */}
      <div className="space-y-6 pt-8 border-t border-border/40">
        <div className="flex items-center gap-3">
          <Code2 className="h-6 w-6" />
          <h2 id="ide-plugins" className="scroll-m-20 text-2xl font-bold tracking-tight">
            IDE Plugins
          </h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Cencori IDE plugins provide real-time security feedback directly in your development environment. Catch security issues before they reach production.
        </p>

        {/* VS Code Extension */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <VSCodeLogo className="h-4 w-4" />
            VS Code Extension
          </h3>

          <p className="text-sm font-medium">Installation</p>
          <ol className="space-y-2 text-sm ml-6">
            <li className="list-decimal">Open VS Code</li>
            <li className="list-decimal">Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)</li>
            <li className="list-decimal">Search for &quot;Cencori&quot;</li>
            <li className="list-decimal">Click Install</li>
          </ol>

          <p className="text-sm font-medium mt-4">Or install via command line:</p>
          <CodeBlock
            filename="terminal"
            language="bash"
            code={`code --install-extension cencori.cencori-vscode`}
          />

          <p className="text-sm font-medium mt-4">Configuration</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Add your credentials to VS Code settings:
          </p>
          <CodeBlock
            filename="settings.json"
            language="json"
            code={`{
  "cencori.apiKey": "cen_your_api_key_here",
  "cencori.projectId": "your_project_id",
  
  // Optional settings
  "cencori.enableRealTimeScanning": true,
  "cencori.scanOnSave": true,
  "cencori.showInlineWarnings": true,
  
  // Security checks to enable
  "cencori.checks": {
    "secrets": true,
    "pii": true,
    "promptInjection": true,
    "unsafeNetworkCalls": true
  }
}`}
          />

          <p className="text-sm font-medium mt-4">Features</p>
          <ul className="space-y-2 text-sm ml-6">
            <li className="list-disc"><strong>Real-time scanning:</strong> Highlights security issues as you type</li>
            <li className="list-disc"><strong>Pre-commit checks:</strong> Scans files before git commits</li>
            <li className="list-disc"><strong>Inline suggestions:</strong> Provides fix suggestions for common issues</li>
            <li className="list-disc"><strong>Dashboard link:</strong> Jump directly to Cencori dashboard for detailed analysis</li>
          </ul>
        </div>

        {/* Cursor Extension */}
        <div className="space-y-4 mt-8">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CursorLogo size={16} />
            Cursor Extension
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The Cursor extension is especially valuable for AI-assisted development, where generated code may inadvertently contain security issues.
          </p>

          <p className="text-sm font-medium">Installation</p>
          <ol className="space-y-2 text-sm ml-6">
            <li className="list-decimal">Open Cursor</li>
            <li className="list-decimal">Go to Extensions</li>
            <li className="list-decimal">Search for &quot;Cencori&quot;</li>
            <li className="list-decimal">Click Install</li>
          </ol>

          <p className="text-sm font-medium mt-4">Cursor-Specific Features</p>
          <ul className="space-y-2 text-sm ml-6">
            <li className="list-disc"><strong>AI-generated code scanning:</strong> Automatically scans code generated by Cursor&apos;s AI</li>
            <li className="list-disc"><strong>Composer integration:</strong> Checks multi-file changes before applying</li>
            <li className="list-disc"><strong>Chat context awareness:</strong> Warns about sensitive data in AI chat context</li>
          </ul>

          <CodeBlock
            filename="settings.json"
            language="json"
            code={`{
  "cencori.apiKey": "cen_your_api_key_here",
  "cencori.projectId": "your_project_id",
  
  // Cursor-specific settings
  "cencori.cursor": {
    "scanGeneratedCode": true,
    "scanComposerChanges": true,
    "warnOnSensitiveContext": true,
    "blockUnsafePatterns": ["eval(", "dangerouslySetInnerHTML"]
  }
}`}
          />
        </div>

        {/* Pre-deploy Checks */}
        <div className="space-y-4 mt-8">
          <h3 className="text-lg font-semibold">Pre-Deploy Checks</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Both IDE extensions can be configured to run comprehensive security checks before deployment:
          </p>
          <CodeBlock
            filename=".cencori.json"
            language="json"
            code={`{
  "version": "1.0",
  "projectId": "your_project_id",
  
  "preDeploy": {
    "enabled": true,
    "failOnError": true,
    "failOnWarning": false,
    
    "checks": {
      "secrets": {
        "enabled": true,
        "patterns": [
          "api_key",
          "secret",
          "password",
          "token",
          "private_key"
        ]
      },
      "pii": {
        "enabled": true,
        "types": ["email", "phone", "ssn", "credit_card"]
      },
      "unsafePatterns": {
        "enabled": true,
        "patterns": [
          "eval\\\\(",
          "dangerouslySetInnerHTML",
          "innerHTML\\\\s*=",
          "document\\\\.write"
        ]
      },
      "networkCalls": {
        "enabled": true,
        "allowedDomains": [
          "api.openai.com",
          "api.anthropic.com",
          "cencori.com"
        ]
      }
    },
    
    "exclude": [
      "node_modules/**",
      ".next/**",
      "dist/**",
      "*.test.ts"
    ]
  }
}`}
          />
        </div>
      </div>

      {/* ==================== CI/CD INTEGRATION ==================== */}
      <div className="space-y-6 pt-8 border-t border-border/40">
        <h2 id="cicd" className="scroll-m-20 text-xl font-semibold tracking-tight">
          CI/CD Integration
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Integrate Cencori checks into your CI/CD pipeline for automated security scanning:
        </p>

        <div className="space-y-4">
          <h3 className="text-base font-semibold">GitHub Actions</h3>
          <CodeBlock
            filename=".github/workflows/cencori.yml"
            language="yaml"
            code={`name: Cencori Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Cencori Scan
        uses: cencori/security-scan-action@v1
        with:
          api-key: \${{ secrets.CENCORI_API_KEY }}
          project-id: \${{ secrets.CENCORI_PROJECT_ID }}
          fail-on-error: true
          
      - name: Upload Results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: cencori-report
          path: cencori-report.json`}
          />
        </div>

        <div className="space-y-4 mt-6">
          <h3 className="text-base font-semibold">GitLab CI</h3>
          <CodeBlock
            filename=".gitlab-ci.yml"
            language="yaml"
            code={`cencori-scan:
  stage: security
  image: cencori/scanner:latest
  script:
    - cencori scan --api-key $CENCORI_API_KEY --project-id $CENCORI_PROJECT_ID
  artifacts:
    reports:
      security: cencori-report.json
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"`}
          />
        </div>
      </div>

      {/* ==================== TROUBLESHOOTING ==================== */}
      <div className="space-y-6 pt-8 border-t border-border/40">
        <h2 id="troubleshooting" className="scroll-m-20 text-xl font-semibold tracking-tight">
          Troubleshooting
        </h2>

        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Middleware Not Triggering
            </h3>
            <p className="text-sm text-muted-foreground">
              Ensure your <code className="text-xs bg-muted px-1 py-0.5 rounded">matcher</code> config in <code className="text-xs bg-muted px-1 py-0.5 rounded">middleware.ts</code> includes the routes you want to protect. Verify with console logging.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Environment Variables Not Loading
            </h3>
            <p className="text-sm text-muted-foreground">
              For Vercel, ensure variables are set in the project settings. For local development, verify your <code className="text-xs bg-muted px-1 py-0.5 rounded">.env.local</code> file is in the project root.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              High Latency
            </h3>
            <p className="text-sm text-muted-foreground">
              Edge processing should add &lt;50ms. If experiencing higher latency, check your region configuration and ensure you&apos;re using the nearest Cencori edge endpoint.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              False Positives
            </h3>
            <p className="text-sm text-muted-foreground">
              Adjust sensitivity settings in your configuration. You can also add patterns to the allowlist in your Cencori dashboard.
            </p>
          </div>
        </div>
      </div>

      {/* ==================== NEXT STEPS ==================== */}
      <div className="space-y-4 pt-8 border-t border-border/40">
        <h2 id="next-steps" className="scroll-m-20 text-xl font-semibold tracking-tight">
          Next Steps
        </h2>
        <ul className="space-y-2 text-sm ml-6">
          <li className="list-disc">
            Configure <Link href="/docs/security/pii-detection" className="text-primary hover:underline">PII Detection</Link> settings for your use case
          </li>
          <li className="list-disc">
            Set up <Link href="/docs/security/prompt-injection" className="text-primary hover:underline">Prompt Injection</Link> protection rules
          </li>
          <li className="list-disc">
            Learn about <Link href="/docs/concepts/rate-limiting" className="text-primary hover:underline">Rate Limiting</Link> at the edge
          </li>
          <li className="list-disc">
            Explore the <Link href="/docs/api" className="text-primary hover:underline">API Reference</Link> for advanced configurations
          </li>
        </ul>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
        <Link href="/docs/installation">
          <Button variant="ghost" className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            <span className="flex flex-col items-start">
              <span className="text-xs text-muted-foreground">Previous</span>
              <span className="text-sm font-medium">Installation</span>
            </span>
          </Button>
        </Link>
        <Link href="/docs/security/pii-detection">
          <Button variant="ghost" className="gap-2">
            <span className="flex flex-col items-end">
              <span className="text-xs text-muted-foreground">Next</span>
              <span className="text-sm font-medium">PII Detection</span>
            </span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
