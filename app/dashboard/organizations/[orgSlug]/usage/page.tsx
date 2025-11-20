"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle2 } from "lucide-react";

export default function UsagePage() {
    const upcomingFeatures = [
        "Real-time usage metrics and analytics",
        "API call tracking and limits",
        "Storage and bandwidth monitoring",
        "Custom date range reports",
        "Usage alerts and notifications",
        "Export usage data to CSV",
        "Team member usage breakdown",
    ];

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center space-x-4 pb-12">
                <Activity className="h-6 w-6" />
                <h1 className="text-xl font-bold">Usage</h1>
                <Badge variant="secondary" className="ml-2">Coming Soon</Badge>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Usage Analytics & Monitoring</CardTitle>
                    <CardDescription>
                        Track your organization&apos;s resource usage and activity metrics
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="text-center py-12">
                        <div className="mx-auto w-fit rounded-full bg-muted p-6 mb-6">
                            <Activity className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Usage Dashboard Coming Soon</h3>
                        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                            Get comprehensive insights into your organization&apos;s resource consumption.
                            Track API calls, storage, bandwidth, and more with detailed analytics and reports.
                        </p>

                        <div className="max-w-md mx-auto text-left">
                            <p className="text-sm font-medium mb-3">Planned Features:</p>
                            <ul className="space-y-2">
                                {upcomingFeatures.map((feature, index) => (
                                    <li key={index} className="flex items-start text-sm text-muted-foreground">
                                        <CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-primary shrink-0" />
                                        {feature}
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
