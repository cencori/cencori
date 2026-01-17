import Link from "next/link";
import { ExternalLink, BarChart3, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Step8Page() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight mb-2">
                    View Your Logs
                </h1>
                <p className="text-muted-foreground">
                    Every request you make is automatically logged. Let&apos;s see what Cencori captures.
                </p>
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Open Your Logs</h2>
                <p className="text-sm text-muted-foreground">
                    Go to your project dashboard and click <strong>Logs</strong> in the sidebar.
                </p>
                <Link href="/dashboard" target="_blank">
                    <Button variant="outline" className="gap-2">
                        Open Dashboard
                        <ExternalLink className="h-4 w-4" />
                    </Button>
                </Link>
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">What&apos;s Logged</h2>
                <p className="text-sm text-muted-foreground">
                    For every request, Cencori captures:
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="p-4 rounded-lg border border-border/50 bg-muted/20">
                        <h3 className="font-medium text-sm mb-2">Request Details</h3>
                        <ul className="text-xs text-muted-foreground space-y-1">
                            <li>• Model used</li>
                            <li>• Input messages</li>
                            <li>• Parameters (temp, max tokens)</li>
                            <li>• Timestamp</li>
                        </ul>
                    </div>
                    <div className="p-4 rounded-lg border border-border/50 bg-muted/20">
                        <h3 className="font-medium text-sm mb-2">Response Details</h3>
                        <ul className="text-xs text-muted-foreground space-y-1">
                            <li>• Output content</li>
                            <li>• Token usage</li>
                            <li>• Cost in USD</li>
                            <li>• Latency (ms)</li>
                        </ul>
                    </div>
                    <div className="p-4 rounded-lg border border-border/50 bg-muted/20">
                        <h3 className="font-medium text-sm mb-2">Security Info</h3>
                        <ul className="text-xs text-muted-foreground space-y-1">
                            <li>• Safety score</li>
                            <li>• PII detected</li>
                            <li>• Threats blocked</li>
                            <li>• Content warnings</li>
                        </ul>
                    </div>
                    <div className="p-4 rounded-lg border border-border/50 bg-muted/20">
                        <h3 className="font-medium text-sm mb-2">Metadata</h3>
                        <ul className="text-xs text-muted-foreground space-y-1">
                            <li>• API key used</li>
                            <li>• Origin/referer</li>
                            <li>• User agent</li>
                            <li>• Geographic region</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Log Features</h2>
                <div className="space-y-3 text-sm">
                    <div className="flex gap-3 items-start">
                        <Search className="h-5 w-5 text-primary shrink-0" />
                        <div>
                            <p className="font-medium">Search</p>
                            <p className="text-muted-foreground">Find specific requests by content or metadata</p>
                        </div>
                    </div>
                    <div className="flex gap-3 items-start">
                        <Filter className="h-5 w-5 text-primary shrink-0" />
                        <div>
                            <p className="font-medium">Filter</p>
                            <p className="text-muted-foreground">Filter by model, API key, status, date range</p>
                        </div>
                    </div>
                    <div className="flex gap-3 items-start">
                        <BarChart3 className="h-5 w-5 text-primary shrink-0" />
                        <div>
                            <p className="font-medium">Analytics</p>
                            <p className="text-muted-foreground">See usage patterns, costs, and trends</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                <p className="text-sm">
                    <strong>🔒 Privacy Note:</strong> Logs are stored securely and only visible to your team. You can configure data retention in project settings.
                </p>
            </div>
        </div>
    );
}
