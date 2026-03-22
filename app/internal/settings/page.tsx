'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Trash2, Check, ShieldCheck, Clock, XCircle, ArrowLeft, BarChart3, Mail, SendHorizontal, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface Admin {
    id: string;
    email: string;
    role: 'admin' | 'super_admin';
    status: 'pending' | 'active' | 'revoked';
    created_at: string;
    accepted_at: string | null;
}

type BroadcastAction = 'dry-run' | 'test' | 'send';

interface BroadcastResponse {
    success: boolean;
    dryRun?: boolean;
    mode?: 'test';
    recipient?: string;
    id?: string;
    subject?: string;
    includeUnconfirmed?: boolean;
    maxRecipients?: number;
    totalFetchedUsers?: number;
    eligibleRecipients?: number;
    sampleRecipients?: string[];
    attempted?: number;
    sent?: number;
    failed?: number;
    capped?: boolean;
    failureSample?: Array<{ email: string; error: string }>;
    message?: string;
}

export default function AdminSettingsPage() {
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'admin' | 'super_admin'>('admin');
    const [copiedLink, setCopiedLink] = useState<string | null>(null);
    const [broadcastSubject, setBroadcastSubject] = useState('');
    const [broadcastHtml, setBroadcastHtml] = useState('');
    const [broadcastText, setBroadcastText] = useState('');
    const [broadcastMaxRecipients, setBroadcastMaxRecipients] = useState('500');
    const [broadcastIncludeUnconfirmed, setBroadcastIncludeUnconfirmed] = useState(false);
    const [broadcastTestRecipient, setBroadcastTestRecipient] = useState('');
    const [broadcastResult, setBroadcastResult] = useState<BroadcastResponse | null>(null);
    const queryClient = useQueryClient();

    const { data, isLoading, error } = useQuery<{ admins: Admin[]; currentUserRole: string }>({
        queryKey: ['admins'],
        queryFn: async () => {
            const res = await fetch('/api/internal/admins');
            const payload = await res.json().catch(() => ({} as { error?: string }));
            if (!res.ok) {
                throw new Error(payload.error || `Failed to fetch admins (${res.status})`);
            }
            return payload as { admins: Admin[]; currentUserRole: string };
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

    const broadcastMutation = useMutation({
        mutationFn: async ({ action }: { action: BroadcastAction }) => {
            const payload = {
                subject: broadcastSubject.trim(),
                html: broadcastHtml.trim(),
                text: broadcastText.trim() || undefined,
                includeUnconfirmed: broadcastIncludeUnconfirmed,
                maxRecipients: Number.parseInt(broadcastMaxRecipients, 10) || 500,
                dryRun: action === 'dry-run',
                testRecipient: action === 'test' ? broadcastTestRecipient.trim() : undefined,
            };

            const res = await fetch('/api/internal/admins/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to process broadcast');
            }
            return { data: data as BroadcastResponse, action };
        },
        onSuccess: ({ data, action }) => {
            setBroadcastResult(data);

            if (action === 'dry-run') {
                toast.success(`Audience preview ready (${data.eligibleRecipients ?? 0} recipients)`);
                return;
            }

            if (action === 'test') {
                toast.success(`Test email sent to ${data.recipient}`);
                return;
            }

            if ((data.failed ?? 0) > 0) {
                toast.warning(`Broadcast finished: ${data.sent ?? 0} sent, ${data.failed ?? 0} failed`);
                return;
            }

            toast.success(`Broadcast sent to ${data.sent ?? 0} recipients`);
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
            <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
                <div className="text-center py-12">
                    <p className="text-sm text-red-500">Failed to load admins</p>
                    <p className="text-xs text-muted-foreground mt-1">{(error as Error).message}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold">Team Settings</h1>
                    <p className="text-[10px] text-muted-foreground">Manage who has access to internal dashboards</p>
                </div>
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
                                className="flex flex-col sm:flex-row gap-2 sm:gap-3"
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

                    {isSuperAdmin && (
                        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
                            <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <h2 className="text-sm font-semibold">Broadcast Product Update</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <Input
                                    type="text"
                                    placeholder="Email subject"
                                    value={broadcastSubject}
                                    onChange={(e) => setBroadcastSubject(e.target.value)}
                                    className="h-9 text-sm"
                                />
                                <Input
                                    type="number"
                                    min={1}
                                    max={2000}
                                    placeholder="Max recipients per run"
                                    value={broadcastMaxRecipients}
                                    onChange={(e) => setBroadcastMaxRecipients(e.target.value)}
                                    className="h-9 text-sm"
                                />
                            </div>

                            <Textarea
                                placeholder="<h1>What's new at Cencori</h1><p>...</p>"
                                value={broadcastHtml}
                                onChange={(e) => setBroadcastHtml(e.target.value)}
                                className="min-h-[220px] text-sm font-mono"
                            />

                            <Textarea
                                placeholder="Optional plain-text fallback"
                                value={broadcastText}
                                onChange={(e) => setBroadcastText(e.target.value)}
                                className="min-h-[100px] text-sm"
                            />

                            <div className="flex flex-col md:flex-row md:items-center gap-3">
                                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                                    <input
                                        type="checkbox"
                                        checked={broadcastIncludeUnconfirmed}
                                        onChange={(e) => setBroadcastIncludeUnconfirmed(e.target.checked)}
                                        className="h-4 w-4"
                                    />
                                    Include unconfirmed emails
                                </label>

                                <Input
                                    type="email"
                                    placeholder="Test recipient (optional)"
                                    value={broadcastTestRecipient}
                                    onChange={(e) => setBroadcastTestRecipient(e.target.value)}
                                    className="h-9 text-sm md:max-w-[320px]"
                                />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => broadcastMutation.mutate({ action: 'dry-run' })}
                                    disabled={
                                        broadcastMutation.isPending ||
                                        !broadcastSubject.trim() ||
                                        !broadcastHtml.trim()
                                    }
                                >
                                    <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
                                    {broadcastMutation.isPending ? 'Working...' : 'Preview Audience'}
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => broadcastMutation.mutate({ action: 'test' })}
                                    disabled={
                                        broadcastMutation.isPending ||
                                        !broadcastSubject.trim() ||
                                        !broadcastHtml.trim() ||
                                        !broadcastTestRecipient.trim()
                                    }
                                >
                                    <Mail className="h-3.5 w-3.5 mr-1.5" />
                                    Send Test
                                </Button>

                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => {
                                        const shouldSend = window.confirm(
                                            'Send this update to the selected audience now?'
                                        );
                                        if (shouldSend) {
                                            broadcastMutation.mutate({ action: 'send' });
                                        }
                                    }}
                                    disabled={
                                        broadcastMutation.isPending ||
                                        !broadcastSubject.trim() ||
                                        !broadcastHtml.trim()
                                    }
                                >
                                    <SendHorizontal className="h-3.5 w-3.5 mr-1.5" />
                                    Send Broadcast
                                </Button>
                            </div>

                            {broadcastResult && (
                                <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                                        Last Broadcast Result
                                    </p>
                                    {broadcastResult.mode === 'test' ? (
                                        <p className="text-sm">
                                            Test email sent to <span className="font-medium">{broadcastResult.recipient}</span>.
                                        </p>
                                    ) : broadcastResult.dryRun ? (
                                        <div className="text-sm space-y-1">
                                            <p>
                                                Eligible recipients: <span className="font-medium">{broadcastResult.eligibleRecipients ?? 0}</span>
                                            </p>
                                            <p>
                                                Total fetched users: <span className="font-medium">{broadcastResult.totalFetchedUsers ?? 0}</span>
                                            </p>
                                            {broadcastResult.capped && (
                                                <p className="text-amber-500">
                                                    Audience preview hit your max-recipient cap ({broadcastResult.maxRecipients}).
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-sm space-y-1">
                                            <p>
                                                Sent: <span className="font-medium">{broadcastResult.sent ?? 0}</span>
                                            </p>
                                            <p>
                                                Failed: <span className="font-medium">{broadcastResult.failed ?? 0}</span>
                                            </p>
                                            <p>
                                                Attempted: <span className="font-medium">{broadcastResult.attempted ?? 0}</span>
                                            </p>
                                            {(broadcastResult.failureSample?.length ?? 0) > 0 && (
                                                <p className="text-xs text-amber-500">
                                                    Some deliveries failed. Inspect server logs for full details.
                                                </p>
                                            )}
                                        </div>
                                    )}
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
