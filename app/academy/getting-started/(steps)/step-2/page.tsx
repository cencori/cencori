import Link from "next/link";
import { ExternalLink, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Step2Page() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight mb-2">
                    Create a Project
                </h1>
                <p className="text-muted-foreground">
                    Projects are containers for your API keys, settings, and logs. Let&apos;s create one.
                </p>
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">What is a Project?</h2>
                <p className="text-sm text-muted-foreground">
                    In Cencori, your work is organized like this:
                </p>
                <div className="p-4 bg-muted/30 rounded-lg border border-border/50 font-mono text-sm">
                    <div>Organization (your team/company)</div>
                    <div className="pl-4 mt-1">└── Project (your app)</div>
                    <div className="pl-8 mt-1">├── API Keys</div>
                    <div className="pl-8">├── Provider Keys (OpenAI, etc.)</div>
                    <div className="pl-8">├── Security Settings</div>
                    <div className="pl-8">└── Logs & Analytics</div>
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Create Your First Project</h2>
                <ol className="space-y-4 text-sm">
                    <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">1</span>
                        <div>
                            <p className="font-medium">Go to your Dashboard</p>
                            <p className="text-muted-foreground mb-2">
                                If you just signed up, you&apos;ll already be there
                            </p>
                            <Link href="/dashboard" target="_blank">
                                <Button variant="outline" size="sm" className="gap-2">
                                    Open Dashboard
                                    <ExternalLink className="h-3 w-3" />
                                </Button>
                            </Link>
                        </div>
                    </li>
                    <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">2</span>
                        <div>
                            <p className="font-medium">Click &quot;New Project&quot;</p>
                            <p className="text-muted-foreground">
                                Find the button in the top-right or the empty state
                            </p>
                        </div>
                    </li>
                    <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">3</span>
                        <div>
                            <p className="font-medium">Name your project</p>
                            <p className="text-muted-foreground">
                                Something like &quot;My First App&quot; or &quot;Tutorial Project&quot; works great
                            </p>
                        </div>
                    </li>
                    <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">4</span>
                        <div>
                            <p className="font-medium">Done! 🎉</p>
                            <p className="text-muted-foreground">
                                You&apos;ll be taken to your project dashboard
                            </p>
                        </div>
                    </li>
                </ol>
            </div>

            <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <p className="text-sm">
                    <strong>💡 Tip:</strong> You can create multiple projects — one for each app or environment (dev, staging, production).
                </p>
            </div>
        </div>
    );
}
