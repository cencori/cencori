'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Trash2, Check, ShieldCheck, Clock, XCircle, ArrowLeft, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface Admin {
    id: string;
    email: string;
    role: 'admin' | 'super_admin';
    status: 'pending' | 'active' | 'revoked';
    created_at: string;
    accepted_at: string | null;
}

export default function AdminSettingsPage() {
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'admin' | 'super_admin'>('admin');
    const [copiedLink, setCopiedLink] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const { data, isLoading, error } = useQuery<{ admins: Admin[]; currentUserRole: string }>({
        queryKey: ['admins'],
        queryFn: async () => {
            const res = await fetch('/api/internal/admins');
            if (!res.ok) throw new Error('Failed to fetch admins');
            return res.json();
        },
    });

    const inviteMutation = useMutation({
        mutationFn: async ({ email, role }: { email: string; role: string }) => {
            const res = await fetch('/api/internal/admins/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, role }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to invite');
            return data;
        },
        onSuccess: (data) => {
            toast.success('Invite created!');
            setInviteEmail('');
            queryClient.invalidateQueries({ queryKey: ['admins'] });
            navigator.clipboard.writeText(data.inviteLink);
            setCopiedLink(data.inviteLink);
            setTimeout(() => setCopiedLink(null), 5000);
        },
        onError: (error: Error) => {
            toast.error(error.message);
        },
    });

    const removeMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/internal/admins/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to remove');
            return data;
        },
        onSuccess: () => {
            toast.success('Admin access revoked');
            queryClient.invalidateQueries({ queryKey: ['admins'] });
        },
        onError: (error: Error) => {
            toast.error(error.message);
        },
    });

    const isSuperAdmin = data?.currentUserRole === 'super_admin';
    const activeAdmins = data?.admins.filter(a => a.status === 'active') || [];
    const pendingAdmins = data?.admins.filter(a => a.status === 'pending') || [];

    if (error) {
        return (
            <div className="w-full max-w-4xl mx-auto px-6 py-8">
                <div className="text-center py-12">
                    <p className="text-sm text-red-500">Failed to load admins</p>
                    <p className="text-xs text-muted-foreground mt-1">{(error as Error).message}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto px-6 py-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/internal/analytics">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-lg font-semibold">Team Settings</h1>
                        <p className="text-[10px] text-muted-foreground">Manage who has access to internal dashboards</p>
                    </div>
                </div>
                <Link href="/internal/analytics">
                    <Button variant="outline" size="sm" className="h-8 text-xs rounded-full">
                        <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                        Analytics
                    </Button>
                </Link>
            </div>

            {isLoading ? (
                <LoadingSkeleton />
            ) : (
                <>
                    {/* Invite Form - Only for super_admins */}
                    {isSuperAdmin && (
                        <div className="rounded-xl border border-border/50 bg-card p-5">
                            <h2 className="text-sm font-semibold mb-4">Invite Team Member</h2>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    if (inviteEmail) {
                                        inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
                                    }
                                }}
                                className="flex gap-3"
                            >
                                <Input
                                    type="email"
                                    placeholder="email@example.com"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    className="h-9 text-sm flex-1"
                                    required
                                />
                                <select
                                    value={inviteRole}
                                    onChange={(e) => setInviteRole(e.target.value as 'admin' | 'super_admin')}
                                    className="h-9 px-3 text-xs rounded-md border border-border bg-background"
                                >
                                    <option value="admin">Admin</option>
                                    <option value="super_admin">Super Admin</option>
                                </select>
                                <Button
                                    type="submit"
                                    size="sm"
                                    className="h-9"
                                    disabled={inviteMutation.isPending || !inviteEmail}
                                >
                                    <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                                    {inviteMutation.isPending ? 'Inviting...' : 'Invite'}
                                </Button>
                            </form>
                            {copiedLink && (
                                <div className="mt-3 flex items-center gap-2 text-xs text-emerald-500">
                                    <Check className="h-3 w-3" />
                                    Invite link copied to clipboard!
                                </div>
                            )}
                        </div>
                    )}

                    {/* Active Admins */}
                    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
                        <div className="px-4 py-3 border-b border-border/40 bg-muted/30">
                            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Active Team ({activeAdmins.length})
                            </h2>
                        </div>
                        <div className="divide-y divide-border/40">
                            {activeAdmins.length === 0 ? (
                                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                                    No active team members
                                </div>
                            ) : (
                                activeAdmins.map((admin) => (
                                    <AdminRow
                                        key={admin.id}
                                        admin={admin}
                                        canRemove={isSuperAdmin}
                                        onRemove={() => removeMutation.mutate(admin.id)}
                                        isRemoving={removeMutation.isPending}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Pending Invites */}
                    {pendingAdmins.length > 0 && (
                        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
                            <div className="px-4 py-3 border-b border-border/40 bg-muted/30">
                                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Pending Invites ({pendingAdmins.length})
                                </h2>
                            </div>
                            <div className="divide-y divide-border/40">
                                {pendingAdmins.map((admin) => (
                                    <AdminRow
                                        key={admin.id}
                                        admin={admin}
                                        canRemove={isSuperAdmin}
                                        onRemove={() => removeMutation.mutate(admin.id)}
                                        isRemoving={removeMutation.isPending}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function AdminRow({
    admin,
    canRemove,
    onRemove,
    isRemoving,
}: {
    admin: Admin;
    canRemove: boolean;
    onRemove: () => void;
    isRemoving: boolean;
}) {
    const statusIcon = {
        active: <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />,
        pending: <Clock className="h-3.5 w-3.5 text-amber-500" />,
        revoked: <XCircle className="h-3.5 w-3.5 text-red-500" />,
    }[admin.status];

    const roleLabel = admin.role === 'super_admin' ? 'Super Admin' : 'Admin';

    return (
        <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
                {statusIcon}
                <div>
                    <p className="text-sm font-medium">{admin.email}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{roleLabel}</span>
                        {admin.accepted_at && (
                            <span className="text-[10px] text-muted-foreground">
                                · Joined {new Date(admin.accepted_at).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            {canRemove && admin.status !== 'revoked' && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-red-500"
                    onClick={onRemove}
                    disabled={isRemoving}
                >
                    <Trash2 className="h-3 w-3" />
                </Button>
            )}
        </div>
    );
}

function LoadingSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
        </div>
    );
}
