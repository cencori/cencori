import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function CencoriScanPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Cencori Scan
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Security scanner for AI apps. Detect hardcoded secrets, PII leaks, exposed routes, and security vulnerabilities — with AI-powered auto-fix.
                </p>
            </div>

            {/* Quick Start */}
            <div className="space-y-4">
                <h2 id="quick-start" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Quick Start
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Run Cencori Scan in any project directory to instantly find security issues:
                </p>

                <CodeBlock
                    filename="terminal"
                    language="bash"
                    code={`npx @cencori/scan`}
                />

                <p className="text-sm text-muted-foreground mt-4">
                    That&apos;s it. The scanner will analyze your codebase and report any security issues found.
                </p>
            </div>

            {/* Installation */}
            <div className="space-y-4">
                <h2 id="installation" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Installation Options
                </h2>

                <CodeBlock
                    filename="terminal"
                    language="bash"
                    code={`# Run directly (recommended)
npx @cencori/scan

# Install globally
npm install -g @cencori/scan

# Or as a dev dependency
npm install -D @cencori/scan`}
                />
            </div>

            {/* What It Detects */}
            <div className="space-y-4">
                <h2 id="detection" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    What It Detects
                </h2>

                <div className="overflow-x-auto mt-4">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Category</th>
                                <th className="text-left p-3 font-semibold">Examples</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3 font-semibold">API Keys & Secrets</td>
                                <td className="p-3">OpenAI, Anthropic, Google AI, Supabase, Stripe, AWS, GitHub, Firebase + 20 more</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">PII</td>
                                <td className="p-3">Email addresses, phone numbers, SSNs, credit cards</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Exposed Routes</td>
                                <td className="p-3">Next.js/Express routes without authentication, sensitive files in /public</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Vulnerabilities</td>
                                <td className="p-3">SQL injection, XSS (innerHTML, dangerouslySetInnerHTML), insecure CORS</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Hardcoded Credentials</td>
                                <td className="p-3">Passwords, tokens, connection strings in code</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* CLI Options */}
            <div className="space-y-4">
                <h2 id="cli-options" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    CLI Options
                </h2>

                <CodeBlock
                    filename="terminal"
                    language="bash"
                    code={`# Scan current directory
npx @cencori/scan

# Scan specific path
npx @cencori/scan ./my-project

# Output JSON (for CI/CD)
npx @cencori/scan --json

# Quiet mode (score only)
npx @cencori/scan --quiet

# Skip interactive prompts
npx @cencori/scan --no-prompt`}
                />
            </div>

            {/* Security Score */}
            <div className="space-y-4">
                <h2 id="security-score" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Security Score
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    After scanning, you&apos;ll receive a security score from A to F:
                </p>

                <div className="overflow-x-auto mt-4">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Score</th>
                                <th className="text-left p-3 font-semibold">Meaning</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3 font-semibold text-green-500">A-Tier</td>
                                <td className="p-3">Excellent - No security issues detected</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold text-blue-500">B-Tier</td>
                                <td className="p-3">Good - Minor improvements recommended</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold text-yellow-500">C-Tier</td>
                                <td className="p-3">Fair - Some concerns need attention</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold text-orange-500">D-Tier</td>
                                <td className="p-3">Poor - Significant issues found</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold text-red-500">F-Tier</td>
                                <td className="p-3">Critical - Secrets or major vulnerabilities exposed</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* AI Auto-Fix */}
            <div className="space-y-4">
                <h2 id="ai-auto-fix" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    AI-Powered Auto-Fix (Pro)
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    After scanning, you&apos;ll be prompted to auto-fix issues. Enter <code className="text-xs bg-muted px-1 py-0.5 rounded">y</code> and provide your Cencori API key:
                </p>

                <CodeBlock
                    filename="terminal"
                    language="text"
                    code={`? Would you like Cencori to auto-fix these issues? (y/n)
> y

  Checking for API key...
  No API key found.

? Enter your Cencori API key: ************************
  (Get one at https://cencori.com/dashboard)

✔ API key saved to ~/.cencorirc
✔ Analyzing with AI...
✔ Filtered 3 false positives
✔ Applied 8 fixes`}
                />

                <p className="text-sm text-muted-foreground mt-4">
                    The AI will:
                </p>
                <ul className="space-y-2 text-sm ml-6 mt-2">
                    <li className="list-disc">Analyze each issue for false positives</li>
                    <li className="list-disc">Generate secure code fixes using Llama 4 Scout</li>
                    <li className="list-disc">Apply fixes automatically to your codebase</li>
                </ul>

                <p className="text-sm text-muted-foreground mt-4">
                    Your API key is saved to <code className="text-xs bg-muted px-1 py-0.5 rounded">~/.cencorirc</code> for future scans.
                </p>
            </div>

            {/* Programmatic Usage */}
            <div className="space-y-4">
                <h2 id="programmatic" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Programmatic Usage
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    You can also use Cencori Scan as a library in your Node.js applications:
                </p>

                <CodeBlock
                    filename="scan.ts"
                    language="typescript"
                    code={`import { scan } from '@cencori/scan';

const result = await scan('./my-project');

console.log(result.score);        // 'A' | 'B' | 'C' | 'D' | 'F'
console.log(result.issues);       // Array of detected issues
console.log(result.filesScanned); // Number of files scanned
console.log(result.scanDuration); // Time in milliseconds`}
                />

                <h3 className="text-base font-semibold mt-6">TypeScript Types</h3>

                <CodeBlock
                    filename="types.ts"
                    language="typescript"
                    code={`interface ScanResult {
  score: 'A' | 'B' | 'C' | 'D' | 'F';
  tierDescription: string;
  issues: ScanIssue[];
  filesScanned: number;
  scanDuration: number;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

interface ScanIssue {
  type: 'secret' | 'pii' | 'route' | 'config' | 'vulnerability';
  severity: 'critical' | 'high' | 'medium' | 'low';
  name: string;
  match: string;
  file: string;
  line: number;
  description?: string;
}`}
                />
            </div>

            {/* CI/CD Integration */}
            <div className="space-y-4">
                <h2 id="ci-cd" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    CI/CD Integration
                </h2>

                <h3 className="text-base font-semibold">GitHub Actions</h3>

                <CodeBlock
                    filename=".github/workflows/security.yml"
                    language="yaml"
                    code={`name: Security Scan

on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Cencori Scan
        run: npx @cencori/scan --json > scan-results.json
        
      - name: Check for failures
        run: |
          SCORE=$(jq -r '.score' scan-results.json)
          if [[ "$SCORE" == "F" ]]; then
            echo "Security scan failed with F-Tier score"
            exit 1
          fi
          
      - name: Upload scan results
        uses: actions/upload-artifact@v4
        with:
          name: security-scan
          path: scan-results.json`}
                />

                <h3 className="text-base font-semibold mt-6">Pre-commit Hook</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Add to <code className="text-xs bg-muted px-1 py-0.5 rounded">.husky/pre-commit</code>:
                </p>

                <CodeBlock
                    filename=".husky/pre-commit"
                    language="bash"
                    code={`#!/bin/sh
npx @cencori/scan --quiet --no-prompt`}
                />
            </div>

            {/* Configuration */}
            <div className="space-y-4">
                <h2 id="configuration" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Configuration
                </h2>

                <h3 className="text-base font-semibold">Environment Variables</h3>

                <div className="overflow-x-auto mt-4">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Variable</th>
                                <th className="text-left p-3 font-semibold">Description</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3 font-mono text-xs">CENCORI_API_KEY</td>
                                <td className="p-3">API key for AI auto-fix features</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h3 className="text-base font-semibold mt-6">Config File</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    API keys are saved to <code className="text-xs bg-muted px-1 py-0.5 rounded">~/.cencorirc</code>:
                </p>

                <CodeBlock
                    filename="~/.cencorirc"
                    language="text"
                    code={`api_key=your_cencori_api_key`}
                />
            </div>

            {/* Privacy */}
            <div className="space-y-4">
                <h2 id="privacy" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Privacy
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Cencori Scan collects anonymous usage metrics to improve the product:
                </p>
                <ul className="space-y-2 text-sm ml-6 mt-2">
                    <li className="list-disc">Number of files scanned</li>
                    <li className="list-disc">Number of issues found</li>
                    <li className="list-disc">Security score</li>
                    <li className="list-disc">Platform (macOS/Linux/Windows)</li>
                </ul>
                <p className="text-sm text-muted-foreground mt-4 font-semibold">
                    No code, file paths, or sensitive data is ever transmitted.
                </p>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/concepts/security">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Security Overview</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/security/scan/web-dashboard">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Web Dashboard</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
