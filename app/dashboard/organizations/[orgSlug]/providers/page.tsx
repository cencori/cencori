"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TechnicalBorder } from "@/components/landing/TechnicalBorder";
import { useParams } from 'next/navigation';
import { Plus, Trash2, Power, PowerOff } from 'lucide-react';

interface CustomProvider {
    id: string;
    name: string;
    base_url: string;
    format: 'openai' | 'anthropic';
    is_active: boolean;
    created_at: string;
}

export default function ProvidersPage() {
    const params = useParams();
    const orgSlug = params.orgSlug as string;
    const [providers, setProviders] = useState<CustomProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [formData, setFormData] = useState({ name: '', baseUrl: '', apiKey: '', format: 'openai' });

    useEffect(() => {
        fetchProviders();
    }, [orgSlug]);

    const fetchProviders = async () => {
        const res = await fetch(`/api/organizations/${orgSlug}/providers`);
        const data = await res.json();
        setProviders(data.providers || []);
        setLoading(false);
    };

    const handleCreate = async () => {
        await fetch(`/api/organizations/${orgSlug}/providers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
        });
        setShowAddDialog(false);
        setFormData({ name: '', baseUrl: '', apiKey: '', format: 'openai' });
        fetchProviders();
    };

    const handleToggle = async (id: string, isActive: boolean) => {
        await fetch(`/api/organizations/${orgSlug}/providers/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: !isActive }),
        });
        fetchProviders();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this provider?')) return;
        await fetch(`/api/organizations/${orgSlug}/providers/${id}`, { method: 'DELETE' });
        fetchProviders();
    };

    return (
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between pb-8">
                <div>
                    <h1 className="text-3xl font-bold">Custom Providers</h1>
                    <p className="text-muted-foreground mt-2">Configure your own AI endpoints</p>
                </div>
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                    <DialogTrigger asChild>
                        <Button className="rounded-none"><Plus className="h-4 w-4 mr-2" />Add Provider</Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-none">
                        <DialogHeader>
                            <DialogTitle>Add Custom Provider</DialogTitle>
                            <DialogDescription>Configure a new AI provider endpoint</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <Input placeholder="Provider Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="rounded-none" />
                            <Input placeholder="Base URL (e.g. https://api.provider.com)" value={formData.baseUrl} onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })} className="rounded-none" />
                            <Input placeholder="API Key (optional)" type="password" value={formData.apiKey} onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })} className="rounded-none" />
                            <Select value={formData.format} onValueChange={(v) => setFormData({ ...formData, format: v as 'openai' | 'anthropic' })}>
                                <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="openai">OpenAI Compatible</SelectItem>
                                    <SelectItem value="anthropic">Anthropic Compatible</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button onClick={handleCreate} className="w-full rounded-none">Create Provider</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {providers.map((provider) => (
                    <TechnicalBorder key={provider.id} cornerSize={16} borderWidth={2} hoverEffect>
                        <Card className="border-0 shadow-none">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle>{provider.name}</CardTitle>
                                        <CardDescription className="mt-1">{provider.base_url}</CardDescription>
                                    </div>
                                    <Badge className="rounded-none" variant={provider.is_active ? "default" : "secondary"}>
                                        {provider.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="text-sm text-muted-foreground">
                                    Format: <span className="font-medium">{provider.format}</span>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <Button variant="outline" size="sm" className="rounded-none flex-1" onClick={() => handleToggle(provider.id, provider.is_active)}>
                                        {provider.is_active ? <PowerOff className="h-4 w-4 mr-1" /> : <Power className="h-4 w-4 mr-1" />}
                                        {provider.is_active ? 'Disable' : 'Enable'}
                                    </Button>
                                    <Button variant="destructive" size="sm" className="rounded-none" onClick={() => handleDelete(provider.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TechnicalBorder>
                ))}
            </div>

            {providers.length === 0 && !loading && (
                <div className="text-center py-12">
                    <p className="text-muted-foreground">No custom providers configured yet.</p>
                    <p className="text-sm text-muted-foreground mt-1">Click &quot;Add Provider&quot; to get started.</p>
                </div>
            )}
        </div>
    );
}
