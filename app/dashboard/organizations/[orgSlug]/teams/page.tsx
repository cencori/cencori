"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, CheckCircle2 } from "lucide-react";

export default function TeamsPage() {
    const upcomingFeatures = [
        "Invite team members via email",
        "Role-based access control (Owner, Admin, Member)",
        "Permission management per project",
        "Team activity logs and audit trails",
        "Member usage tracking",
        "Bulk member operations",
        "SSO and SAML authentication",
        "Custom team roles and permissions",
    ];

    return (
        <div className="mx-92 py-24">
            <div className="flex items-center space-x-4 pb-12">
                <Users className="h-6 w-6" />
                <h1 className="text-xl font-bold">Teams</h1>
                <Badge variant="secondary" className="ml-2">Coming Soon</Badge>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Team Management</CardTitle>
                    <CardDescription>
                        Invite and manage team members with role-based access control
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="text-center py-12">
                        <div className="mx-auto w-fit rounded-full bg-muted p-6 mb-6">
                            <Users className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Team Collaboration Coming Soon</h3>
                        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                            Collaborate with your team seamlessly. Invite members, assign roles,
                            and manage permissions across all your projects in one place.
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
