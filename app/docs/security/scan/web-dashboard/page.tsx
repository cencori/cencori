import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WebDashboardPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Scan Web Dashboard
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Connect your GitHub repositories and run security scans directly from your browser. View scan history, generate changelogs, and manage projects.
                </p>
            </div>

            {/* Getting Started */}
            <div className="space-y-4">
                <h2 id="getting-started" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Getting Started
                </h2>
                <ol className="space-y-3 text-sm ml-6">
                    <li className="list-decimal">
                        <strong>Sign in</strong> to your Cencori account at <Link href="/scan" className="text-primary hover:underline">cencori.com/scan</Link>
                    </li>
                    <li className="list-decimal">
                        <strong>Connect GitHub</strong> — Click &quot;Import Project&quot; and authorize the Cencori GitHub App
                    </li>
                    <li className="list-decimal">
                        <strong>Select a repository</strong> — Choose which repos to scan from your connected organizations
                    </li>
                    <li className="list-decimal">
                        <strong>Run a scan</strong> — Click &quot;Scan Now&quot; to analyze your codebase for security issues
                    </li>
                </ol>
            </div>

            {/* Features */}
            <div className="space-y-4">
                <h2 id="features" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Dashboard Features
                </h2>

                <div className="space-y-6">
                    <div>
                        <h3 className="text-base font-semibold mb-2">Real-Time Scanning</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Watch scan results appear in real-time as files are analyzed. The dashboard uses Server-Sent Events (SSE) to stream results as they&apos;re discovered.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Scan History</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            View all previous scans for a project. Compare security scores over time and track your progress toward a cleaner codebase.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Detailed Issue Reports</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Click on any issue to see the affected file, line number, and matched pattern. Filter by severity (critical, high, medium, low) or type (secrets, PII, routes, vulnerabilities).
                        </p>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Changelog Generation</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Generate AI-powered changelogs from your commit history. Select a date range and the dashboard will analyze your commits and produce a formatted changelog.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Project Settings</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Configure scan settings, set up notifications, and manage team access for each project.
                        </p>
                    </div>
                </div>
            </div>

            {/* GitHub Integration */}
            <div className="space-y-4">
                <h2 id="github" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    GitHub Integration
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Cencori GitHub App requires the following permissions:
                </p>
                <div className="overflow-x-auto mt-4">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Permission</th>
                                <th className="text-left p-3 font-semibold">Access</th>
                                <th className="text-left p-3 font-semibold">Purpose</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Contents</td>
                                <td className="p-3">Read</td>
                                <td className="p-3">Read file contents to scan for security issues</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Metadata</td>
                                <td className="p-3">Read</td>
                                <td className="p-3">List repositories and basic repo information</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Commit statuses</td>
                                <td className="p-3">Read</td>
                                <td className="p-3">Read commit history for changelog generation</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                    You can revoke access at any time from your GitHub settings → Applications → Installed GitHub Apps.
                </p>
            </div>

            {/* vs CLI */}
            <div className="space-y-4">
                <h2 id="cli-comparison" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Web Dashboard vs CLI
                </h2>
                <div className="overflow-x-auto mt-4">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Feature</th>
                                <th className="text-left p-3 font-semibold">Web Dashboard</th>
                                <th className="text-left p-3 font-semibold">CLI</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3 font-semibold">GitHub Integration</td>
                                <td className="p-3">Built-in</td>
                                <td className="p-3">—</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Scan History</td>
                                <td className="p-3">Persistent</td>
                                <td className="p-3">—</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Changelog Generation</td>
                                <td className="p-3">UI</td>
                                <td className="p-3">Command</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">AI Auto-Fix</td>
                                <td className="p-3">Coming</td>
                                <td className="p-3">Available</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">CI/CD Integration</td>
                                <td className="p-3">—</td>
                                <td className="p-3">JSON output</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Local Files</td>
                                <td className="p-3">— (GitHub only)</td>
                                <td className="p-3">Any directory</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/security/scan">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Cencori Scan</span>
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
