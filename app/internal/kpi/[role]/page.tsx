"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

interface Metric {
    key: string;
    label: string;
    target: number | null;
    unit?: string;
    type?: string;
}

interface KPIRole {
    id: string;
    name: string;
    metrics: Metric[];
}

interface KPIEntry {
    metric_key: string;
    metric_value: number;
    notes: string | null;
}

export default function RoleKPIPage() {
    const params = useParams();
    const router = useRouter();
    const roleId = params.role as string;

    const [role, setRole] = useState<KPIRole | null>(null);
    const [entries, setEntries] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState<{ email: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const now = new Date();
    const periodMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    useEffect(() => {
        async function loadData() {
            // Check auth
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !user.email?.endsWith('@cencori.com')) {
                router.push('/internal/kpi/login');
                return;
            }
            setUser({ email: user.email });

            // Fetch role
            const { data: roleData, error: roleError } = await supabase
                .from('kpi_roles')
                .select('*')
                .eq('id', roleId)
                .single();

            if (roleError || !roleData) {
                setError('Role not found');
                setLoading(false);
                return;
            }

            setRole(roleData as KPIRole);

            // Fetch existing entries for this month
            const { data: entriesData } = await supabase
                .from('kpi_entries')
                .select('metric_key, metric_value, notes')
                .eq('role_id', roleId)
                .eq('period_month', periodMonth);

            if (entriesData) {
                const entriesMap: Record<string, string> = {};
                entriesData.forEach((entry: KPIEntry) => {
                    entriesMap[entry.metric_key] = String(entry.metric_value);
                    if (entry.notes) {
                        entriesMap[`${entry.metric_key}_notes`] = entry.notes;
                    }
                });
                setEntries(entriesMap);
            }

            setLoading(false);
        }

        loadData();
    }, [roleId, router, supabase, periodMonth]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccess(false);

        const { data: { user } } = await supabase.auth.getUser();

        try {
            for (const metric of role?.metrics || []) {
                const value = entries[metric.key];
                if (value === undefined || value === '') continue;

                const { error: upsertError } = await supabase
                    .from('kpi_entries')
                    .upsert({
                        role_id: roleId,
                        metric_key: metric.key,
                        metric_value: parseFloat(value) || 0,
                        period_month: periodMonth,
                        submitted_by: user?.id,
                        notes: entries[`${metric.key}_notes`] || null,
                        updated_at: new Date().toISOString(),
                    }, {
                        onConflict: 'role_id,metric_key,period_month'
                    });

                if (upsertError) throw upsertError;
            }

            setSuccess(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        }

        setSaving(false);
    }

    if (loading) {
        return (
            <div className="min-h-svh bg-background flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
        );
    }

    if (error && !role) {
        return (
            <div className="min-h-svh bg-background flex items-center justify-center">
                <div className="text-center space-y-4">
                    <p className="text-sm text-muted-foreground">{error}</p>
                    <Link href="/internal/kpi" className="text-sm text-primary hover:underline">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-svh bg-background">
            {/* Header */}
            <header className="border-b border-border/40 bg-card/50 sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/">
                            <Logo variant="full" className="h-4" />
                        </Link>
                        <span className="text-muted-foreground text-[10px]">/</span>
                        <Link href="/internal/kpi" className="text-xs text-muted-foreground hover:text-foreground">
                            KPIs
                        </Link>
                        <span className="text-muted-foreground text-[10px]">/</span>
                        <span className="text-xs font-medium">{role?.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground">{user?.email}</span>
                        <form action="/api/auth/signout" method="POST">
                            <button type="submit" className="text-[10px] text-muted-foreground hover:text-foreground">
                                Sign out
                            </button>
                        </form>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
                {/* Title */}
                <div className="space-y-1">
                    <h1 className="text-lg font-semibold tracking-tight">
                        {role?.name} - {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h1>
                    <p className="text-[11px] text-muted-foreground">
                        Update your KPIs for this month
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="border border-border/40 rounded-lg divide-y divide-border/40 bg-card/50">
                        {role?.metrics.map((metric) => (
                            <div key={metric.key} className="px-4 py-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs text-muted-foreground">
                                        {metric.label}
                                        {metric.target !== null && (
                                            <span className="ml-2 text-[10px]">(target: {metric.target})</span>
                                        )}
                                    </label>
                                    {metric.type !== 'text' && (
                                        <input
                                            type="number"
                                            step="any"
                                            value={entries[metric.key] || ''}
                                            onChange={(e) => setEntries({ ...entries, [metric.key]: e.target.value })}
                                            className="w-24 px-2 py-1 text-sm bg-background border border-border/40 rounded text-right tabular-nums"
                                            placeholder="0"
                                        />
                                    )}
                                </div>
                                {(metric.type === 'text' || metric.unit === undefined) && (
                                    <textarea
                                        value={entries[`${metric.key}_notes`] || entries[metric.key] || ''}
                                        onChange={(e) => setEntries({
                                            ...entries,
                                            [metric.type === 'text' ? metric.key : `${metric.key}_notes`]: e.target.value
                                        })}
                                        className="w-full px-2 py-1 text-xs bg-background border border-border/40 rounded resize-none"
                                        rows={2}
                                        placeholder={metric.type === 'text' ? 'Enter notes...' : 'Optional notes...'}
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    {error && (
                        <p className="text-xs text-red-500">{error}</p>
                    )}

                    {success && (
                        <p className="text-xs text-green-500">Saved successfully!</p>
                    )}

                    <div className="flex items-center gap-4">
                        <Button type="submit" disabled={saving} className="text-xs">
                            {saving ? 'Saving...' : 'Save Updates'}
                        </Button>
                        <Link href="/internal/kpi" className="text-xs text-muted-foreground hover:text-foreground">
                            Back to Dashboard
                        </Link>
                    </div>
                </form>
            </main>
        </div>
    );
}
