"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TechnicalBorder } from "@/components/landing/TechnicalBorder";
import { Cpu, Zap, Settings } from 'lucide-react';
import Link from 'next/link';

interface ProvidersOverviewProps {
    orgSlug: string;
}

export function ProvidersOverview({ orgSlug }: ProvidersOverviewProps) {
    const [providerCount, setProviderCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProviders();
    }, [orgSlug]);

    const fetchProviders = async () => {
        try {
            const res = await fetch(`/api/organizations/${orgSlug}/providers`);
            const data = await res.json();
            setProviderCount(data.providers?.length || 0);
        } catch (error) {
            console.error('Failed to fetch providers:', error);
        } finally {
            setLoading(false);
        }
    };

    const coreProviders = [
        { name: 'OpenAI', models: 'GPT-4, GPT-3.5', icon: Zap },
        { name: 'Anthropic', models: 'Claude 3', icon: Cpu },
        { name: 'Google', models: 'Gemini 2.5', icon: Zap },
    ];

    return (
        <TechnicalBorder cornerSize={16} borderWidth={2} hoverEffect>
            <Card className="border-0 shadow-none">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>AI Providers</CardTitle>
                            <CardDescription>Multi-model support enabled</CardDescription>
                        </div>
                        <Link href={`/dashboard/organizations/${orgSlug}/providers`}>
                            <Settings className="h-5 w-5 text-muted-foreground hover:text-foreground cursor-pointer" />
                        </Link>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {coreProviders.map((provider) => (
                        <div key={provider.name} className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-3">
                                <provider.icon className="h-4 w-4 text-primary" />
                                <div>
                                    <div className="font-medium text-sm">{provider.name}</div>
                                    <div className="text-xs text-muted-foreground">{provider.models}</div>
                                </div>
                            </div>
                            <Badge variant="default" className="rounded-none text-xs">Active</Badge>
                        </div>
                    ))}

                    {providerCount > 0 && (
                        <div className="pt-2 border-t">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Custom providers</span>
                                <Badge variant="secondary" className="rounded-none">{providerCount}</Badge>
                            </div>
                        </div>
                    )}

                    <Link href={`/dashboard/organizations/${orgSlug}/providers`} className="block pt-2">
                        <div className="text-sm text-primary hover:underline cursor-pointer">
                            Manage providers →
                        </div>
                    </Link>
                </CardContent>
            </Card>
        </TechnicalBorder>
    );
}
