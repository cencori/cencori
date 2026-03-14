'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PromptVersionHistoryProps {
    projectId: string;
    promptId: string;
    activeVersionId: string | null;
}

interface Version {
    id: string;
    version: number;
    content: string;
    model_hint: string | null;
    temperature: number | null;
    max_tokens: number | null;
    variables: string[];
    change_message: string | null;
    created_at: string;
}

function timeAgo(date: string): string {
    const ms = Date.now() - new Date(date).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export function PromptVersionHistory({ projectId, promptId, activeVersionId }: PromptVersionHistoryProps) {
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery<{ versions: Version[] }>({
        queryKey: ['promptVersions', promptId],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/prompts/${promptId}/versions`);
            if (!res.ok) throw new Error('Failed to fetch versions');
            return res.json();
        },
    });

    const deployMutation = useMutation({
        mutationFn: async (versionId: string) => {
            const res = await fetch(`/api/projects/${projectId}/prompts/${promptId}/deploy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ version_id: versionId }),
            });
            if (!res.ok) throw new Error('Deploy failed');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['promptVersions', promptId] });
            queryClient.invalidateQueries({ queryKey: ['promptDetail', promptId] });
        },
    });

    if (isLoading || !data) {
        return <div className="text-xs text-muted-foreground/50 py-8 text-center">Loading versions...</div>;
    }

    return (
        <div className="space-y-1">
            {data.versions.map((v) => {
                const isActive = v.id === activeVersionId;
                return (
                    <div
                        key={v.id}
                        className={cn(
                            'rounded-lg border p-3 transition-colors',
                            isActive
                                ? 'border-emerald-500/30 bg-emerald-500/5'
                                : 'border-border/20 bg-card hover:border-border/40'
                        )}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-medium">v{v.version}</span>
                                {isActive && (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                                        <Check className="h-3 w-3" />
                                        Active
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground/40">{timeAgo(v.created_at)}</span>
                                {!isActive && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-[10px] gap-1"
                                        onClick={() => deployMutation.mutate(v.id)}
                                        disabled={deployMutation.isPending}
                                    >
                                        <RotateCcw className="h-3 w-3" />
                                        Deploy
                                    </Button>
                                )}
                            </div>
                        </div>
                        {v.change_message && (
                            <p className="text-xs text-muted-foreground mb-2">{v.change_message}</p>
                        )}
                        <pre className="text-[11px] text-muted-foreground/60 font-mono whitespace-pre-wrap max-h-24 overflow-hidden">
                            {v.content.slice(0, 300)}{v.content.length > 300 ? '...' : ''}
                        </pre>
                        <div className="flex items-center gap-3 mt-2">
                            {v.model_hint && (
                                <span className="text-[10px] text-muted-foreground/40 font-mono">{v.model_hint}</span>
                            )}
                            {v.variables.length > 0 && (
                                <span className="text-[10px] text-muted-foreground/40">
                                    {v.variables.length} variable{v.variables.length !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
