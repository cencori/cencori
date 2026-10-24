'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';

type ToggleState = { enabled: boolean; gatedMessage?: string };

/**
 * One opt-in project switch backed by a settings endpoint. A plan-gated
 * endpoint (403 FEATURE_NOT_INCLUDED) renders the switch disabled with the
 * reason instead of an unexplained dead control.
 */
function useProjectToggleSetting({
    queryKey,
    title,
    description,
    load,
    save,
    onLabel,
    offLabel,
}: {
    queryKey: readonly unknown[];
    title: string;
    description: string;
    load: () => Promise<Response>;
    save: (enabled: boolean) => Promise<Response>;
    onLabel: string;
    offLabel: string;
}) {
    const queryClient = useQueryClient();
    const { data, isLoading, isError } = useQuery<ToggleState | { raw: unknown }>({
        queryKey,
        queryFn: async () => {
            const response = await load();
            const body = await response.json().catch(() => ({}));
            if (response.status === 403 && body?.code === 'FEATURE_NOT_INCLUDED') {
                return { enabled: false, gatedMessage: body.error as string };
            }
            if (!response.ok) throw new Error(body?.error || 'Failed to load setting');
            return { raw: body };
        },
        staleTime: 60 * 1000,
    });
    const { mutate, isPending } = useMutation({
        mutationFn: async (enabled: boolean) => {
            const response = await save(enabled);
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || 'Failed to save setting');
            }
        },
        onSuccess: (_data, enabled) => {
            queryClient.invalidateQueries({ queryKey });
            toast.success(enabled ? onLabel : offLabel);
        },
        onError: (error: Error) => toast.error(error.message),
    });

    return { data, isLoading, isError, mutate, isPending, title, description };
}

function ToggleRow({
    title,
    description,
    enabled,
    loading,
    disabled,
    note,
    onChange,
}: {
    title: string;
    description: string;
    enabled: boolean;
    loading: boolean;
    disabled: boolean;
    note?: string;
    onChange: (enabled: boolean) => void;
}) {
    return (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between px-4 py-3 gap-2 md:gap-4">
            <div className="space-y-0.5">
                <p className="text-sm md:text-xs font-medium">{title}</p>
                <p className="text-xs md:text-[10px] text-muted-foreground">{description}</p>
                {note && <p className="text-xs md:text-[10px] text-amber-500">{note}</p>}
            </div>
            {loading ? (
                <Skeleton className="h-5 w-9 rounded-full" />
            ) : (
                <Switch checked={enabled} disabled={disabled} onCheckedChange={onChange} aria-label={title} />
            )}
        </div>
    );
}

/**
 * PII protection is the only built-in check, and it is opt-in: Cencori does
 * not make security decisions for a project unless it turns this on. Blocked
 * requests show up in Logs as filtered.
 */
export function PiiProtectionSetting({ projectId }: { projectId: string }) {
    const setting = useProjectToggleSetting({
        queryKey: ['securitySettings', projectId],
        title: 'PII protection',
        description: 'Block requests that contain emails, phone numbers, SSNs or card numbers. Blocked requests appear in Logs.',
        load: () => fetch(`/api/projects/${projectId}/security/settings`),
        save: (enabled) => fetch(`/api/projects/${projectId}/security/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ security_enabled: enabled, filter_pii: enabled }),
        }),
        onLabel: 'PII protection on',
        offLabel: 'PII protection off',
    });
    const raw = setting.data && 'raw' in setting.data
        ? (setting.data.raw as { settings?: { security_enabled?: boolean; filter_pii?: boolean } }).settings
        : undefined;
    const gated = setting.data && 'gatedMessage' in setting.data ? setting.data.gatedMessage : undefined;
    const enabled = raw?.security_enabled === true && raw.filter_pii !== false;

    return (
        <ToggleRow
            title={setting.title}
            description={setting.description}
            enabled={enabled}
            loading={setting.isLoading}
            disabled={setting.isPending || !raw}
            note={gated ?? (setting.isError ? 'Could not load this setting.' : undefined)}
            onChange={(checked) => setting.mutate(checked)}
        />
    );
}

/**
 * Response caching reuses a stored answer for a repeated request instead of
 * calling the model again. Off unless the project turns it on; the switch only
 * flips cache_enabled, so any existing tuning (TTL, semantic match) is kept.
 */
export function ResponseCachingSetting({ projectId }: { projectId: string }) {
    const setting = useProjectToggleSetting({
        queryKey: ['cacheSettings', projectId],
        title: 'Response caching',
        description: 'Reuse stored responses for repeated requests instead of calling the model again.',
        load: () => fetch(`/api/projects/${projectId}/cache/settings`),
        save: (enabled) => fetch(`/api/projects/${projectId}/cache/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cache_enabled: enabled }),
        }),
        onLabel: 'Response caching on',
        offLabel: 'Response caching off',
    });
    const raw = setting.data && 'raw' in setting.data
        ? (setting.data.raw as { cache_enabled?: boolean })
        : undefined;
    const gated = setting.data && 'gatedMessage' in setting.data ? setting.data.gatedMessage : undefined;

    return (
        <ToggleRow
            title={setting.title}
            description={setting.description}
            enabled={raw?.cache_enabled === true}
            loading={setting.isLoading}
            disabled={setting.isPending || !raw}
            note={gated ?? (setting.isError ? 'Could not load this setting.' : undefined)}
            onChange={(checked) => setting.mutate(checked)}
        />
    );
}
