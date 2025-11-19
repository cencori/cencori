"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plug, CheckCircle2 } from "lucide-react";

export default function IntegrationsPage() {
    const upcomingIntegrations = [
        "GitHub integration for repository sync",
        "Slack notifications and webhooks",
        "Discord bot integration",
        "Zapier automation workflows",
        "Google Workspace integration",
        "Microsoft Teams notifications",
        "Custom webhook endpoints",
        "OAuth provider connections",
    ];

    return (
        <div className="mx-92 py-24">
            <div className="flex items-center space-x-4 pb-12">
                <Plug className="h-6 w-6" />
                <h1 className="text-xl font-bold">Integrations</h1>
                <Badge variant="secondary" className="ml-2">Coming Soon</Badge>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Third-Party Integrations</CardTitle>
                    <CardDescription>
                        Connect your favorite tools and services to streamline your workflow
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="text-center py-12">
                        <div className="mx-auto w-fit rounded-full bg-muted p-6 mb-6">
                            <Plug className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Integrations Hub Coming Soon</h3>
                        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                            Connect Cencori with your existing tools and workflows.
                            We&apos;re building integrations with popular services to enhance your productivity.
                        </p>

                        <div className="max-w-md mx-auto text-left">
                            <p className="text-sm font-medium mb-3">Planned Integrations:</p>
                            <ul className="space-y-2">
                                {upcomingIntegrations.map((integration, index) => (
                                    <li key={index} className="flex items-start text-sm text-muted-foreground">
                                        <CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-primary shrink-0" />
                                        {integration}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
