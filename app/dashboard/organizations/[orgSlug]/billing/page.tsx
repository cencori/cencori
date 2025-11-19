"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle2 } from "lucide-react";

export default function BillingPage() {
    const upcomingFeatures = [
        "Subscription management",
        "Payment method updates",
        "Billing history and invoices",
        "Usage-based pricing tiers",
        "Team member billing allocation",
        "Automatic invoice generation",
    ];

    return (
        <div className="mx-92 py-24">
            <div className="flex items-center space-x-4 pb-12">
                <CreditCard className="h-6 w-6" />
                <h1 className="text-xl font-bold">Billing</h1>
                <Badge variant="secondary" className="ml-2">Coming Soon</Badge>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Billing & Subscription Management</CardTitle>
                    <CardDescription>
                        Manage your subscription, payment methods, and billing history
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="text-center py-12">
                        <div className="mx-auto w-fit rounded-full bg-muted p-6 mb-6">
                            <CreditCard className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Billing Dashboard Coming Soon</h3>
                        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                            We're integrating Stripe to bring you a complete billing experience.
                            Soon you'll be able to manage subscriptions, update payment methods, and view your billing history.
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
