"use client";

import Navbar from "@/components/landing/Navbar";
import { PlaygroundChat } from "@/components/dashboard/playground/PlaygroundChat";
import { cn } from "@/lib/utils";

const DEMO_PROJECT_ID = process.env.NEXT_PUBLIC_DEMO_PROJECT_ID;
const DEMO_ORG_ID = process.env.NEXT_PUBLIC_DEMO_ORG_ID;

export default function PublicPlaygroundPage() {
    if (!DEMO_PROJECT_ID) {
        return (
            <div className="min-h-screen bg-background text-foreground selection:bg-foreground selection:text-background">
                <Navbar />
                <main className="flex min-h-0 flex-1 flex-col items-center justify-center pt-20 px-4">
                    <div className="max-w-md text-center space-y-3">
                        <h1 className="text-sm font-semibold">Playground not configured</h1>
                        <p className="text-xs text-muted-foreground">
                            The public playground demo project has not been set up yet.
                            Set <code className="text-[10px] bg-muted px-1 py-0.5 rounded">NEXT_PUBLIC_DEMO_PROJECT_ID</code>{" "}
                            in your environment variables.
                        </p>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div
            className={cn(
                "flex h-svh flex-col overflow-hidden bg-background text-foreground",
                "selection:bg-foreground selection:text-background"
            )}
        >
            <Navbar />
            <main className="flex min-h-0 flex-1 flex-col pt-12">
                <PlaygroundChat
                    environment="production"
                    projectId={DEMO_PROJECT_ID}
                    orgId={DEMO_ORG_ID ?? ""}
                    subscriptionTier="free"
                    isPublic
                />
            </main>
        </div>
    );
}
