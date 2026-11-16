'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';

// Tensor accounts on the internal Tensor page: find one, clear the tasks counted in its week,
// clear everyone's, or put a plan on it (database/brimble/2400_tensor_admin_resets.sql).
// A reset clears task counts only. Plan dates and the month's cost ceiling stay as they are.

interface Account {
    user_id: string;
    email: string;
    username: string | null;
    plan: string;
    plan_ends_at: string | null;
    tasks_used: number;
    tasks_limit: number | null;
    week_ends_at: string | null;
}

interface LogEntry {
    id: number;
    at: string;
    admin: string;
    action: 'reset_week' | 'reset_week_all' | 'set_plan';
    email: string | null;
    detail: { plan?: string; from?: string; scope?: string; accounts?: number; tasks_cleared?: number };
}

interface AccountsResponse {
    accounts: Account[];
    in_use: { paid: number; all: number };
    plans: Array<{ code: string; name: string }>;
    log: LogEntry[];
}

type Scope = 'paid' | 'all';

/** What is waiting on a yes in the confirmation dialog. */
type Pending =
    | { kind: 'reset_all' }
    | { kind: 'set_plan'; account: Account; plan: { code: string; name: string } };

const ERRORS: Record<string, string> = {
    not_installed: 'This database doesn’t have the account tools yet. They’re applied on the next deploy.',
    basecode_account_missing: 'That person has no Tensor account yet. Put a plan on them to create one.',
    basecode_paid_plan_unavailable: 'That plan isn’t available.',
    Forbidden: 'This account can’t use the internal panel.',
    Unauthorized: 'Sign in again to continue.',
};

// Text at 16px on a phone, so focusing a field doesn't make the browser zoom the page.
const PICKER =
    'h-9 rounded-md border border-border/45 bg-muted/20 px-2 text-base text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 sm:h-8 sm:text-[11px]';

/** One account: stacked on a phone, four columns from a tablet up. */
const ROW = 'px-5 sm:grid-cols-[minmax(0,1.7fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto] sm:items-center sm:gap-x-4';

function message(error: unknown): string {
    const code = error instanceof Error ? error.message : '';
    return ERRORS[code] ?? 'That didn’t go through. Try again.';
}

function day(value: string | null): string {
    return value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '–';
}

function planName(code: string, plans: AccountsResponse['plans']): string {
    if (code === 'free') return 'Free';
    return plans.find((plan) => plan.code === code)?.name ?? code;
}

function people(count: number): string {
    return `${count.toLocaleString('en-US')} ${count === 1 ? 'account' : 'accounts'}`;
}

function tasks(count: number): string {
    return `${count.toLocaleString('en-US')} ${count === 1 ? 'task' : 'tasks'}`;
}

function describe(entry: LogEntry, plans: AccountsResponse['plans']): string {
    if (entry.action === 'reset_week_all') {
        const who = entry.detail.scope === 'all' ? 'everyone' : 'paid plans';
        return `Reset the week for ${who}: ${people(entry.detail.accounts ?? 0)}, ${tasks(entry.detail.tasks_cleared ?? 0)} cleared`;
    }
    const account = entry.email ?? 'a deleted account';
    if (entry.action === 'reset_week') {
        return `Reset the week for ${account}: ${tasks(entry.detail.tasks_cleared ?? 0)} cleared`;
    }
    return `Put ${account} on ${planName(entry.detail.plan ?? '', plans)}`;
}

async function post(body: Record<string, string>): Promise<Record<string, unknown>> {
    const response = await fetch('/api/internal/tensor/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error ?? 'query_failed');
    return data;
}

export function TensorAccounts() {
    const queryClient = useQueryClient();
    const [typed, setTyped] = useState('');
    const [search, setSearch] = useState('');
    const [scope, setScope] = useState<Scope>('paid');
    const [pending, setPending] = useState<Pending | null>(null);

    // Searching waits for a pause in typing.
    useEffect(() => {
        const timer = setTimeout(() => setSearch(typed.trim()), 250);
        return () => clearTimeout(timer);
    }, [typed]);

    const { data, isLoading, isError, error } = useQuery<AccountsResponse>({
        queryKey: ['internal-tensor-accounts', search],
        queryFn: async () => {
            const response = await fetch(`/api/internal/tensor/accounts?q=${encodeURIComponent(search)}`);
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(body?.error ?? 'query_failed');
            return body as AccountsResponse;
        },
        staleTime: 15_000,
        placeholderData: (previous) => previous,
    });

    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ['internal-tensor-accounts'] });
        void queryClient.invalidateQueries({ queryKey: ['internal-tensor'] });
    };

    const resetOne = useMutation({
        mutationFn: (account: Account) => post({ action: 'reset_week', userId: account.user_id }),
        onSuccess: (result, account) => {
            const cleared = Number(result.tasks_cleared ?? 0);
            toast.success(cleared > 0 ? `Week reset for ${account.email}` : `${account.email} had nothing to clear`);
            refresh();
        },
        onError: (failure) => toast.error(message(failure)),
    });

    const resetAll = useMutation({
        mutationFn: (which: Scope) => post({ action: 'reset_week_all', scope: which }),
        onSuccess: (result) => {
            toast.success(`Week reset for ${people(Number(result.accounts ?? 0))}`);
            refresh();
        },
        onError: (failure) => toast.error(message(failure)),
    });

    const setPlan = useMutation({
        mutationFn: (change: { account: Account; plan: { code: string; name: string } }) =>
            post({ action: 'set_plan', userId: change.account.user_id, plan: change.plan.code }),
        onSuccess: (_result, change) => {
            toast.success(`${change.account.email} is on ${change.plan.name}`);
            refresh();
        },
        onError: (failure) => toast.error(message(failure)),
    });

    const accounts = data?.accounts ?? [];
    const plans = data?.plans ?? [];
    const log = data?.log ?? [];
    const affected = data?.in_use?.[scope] ?? 0;
    const busy = resetOne.isPending || resetAll.isPending || setPlan.isPending;

    const confirm = () => {
        if (pending?.kind === 'reset_all') resetAll.mutate(scope);
        if (pending?.kind === 'set_plan') setPlan.mutate({ account: pending.account, plan: pending.plan });
        setPending(null);
    };

    return (
        <article className="overflow-hidden rounded-lg border border-border/40 bg-muted/30">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-5 py-3.5">
                <div className="min-w-0">
                    <p className="text-sm font-medium tracking-[-0.01em] text-foreground">Accounts</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        A reset clears the tasks counted this week. Plan dates and the month’s cost ceiling stay.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={scope}
                        onChange={(event) => setScope(event.target.value as Scope)}
                        aria-label="Who a reset of everyone covers"
                        className={PICKER}
                    >
                        <option value="paid">Paid plans</option>
                        <option value="all">Everyone</option>
                    </select>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy || !data}
                        onClick={() => setPending({ kind: 'reset_all' })}
                    >
                        Reset the week
                    </Button>
                </div>
            </header>

            <div className="border-b border-border/40 px-5 py-3">
                <Input
                    type="search"
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                    placeholder="Find by email or username"
                    aria-label="Find an account by email or username"
                    className="h-9 max-w-sm text-base sm:h-8 sm:text-xs"
                />
            </div>

            {isError && !data ? (
                <p className="px-5 py-6 text-xs text-red-600 dark:text-red-400">{message(error)}</p>
            ) : accounts.length === 0 ? (
                <p className="px-5 py-6 text-xs text-muted-foreground">
                    {isLoading ? 'Loading…' : search ? `No account matches “${search}”.` : 'No accounts yet.'}
                </p>
            ) : (
                <ul className="text-xs">
                    <li
                        aria-hidden="true"
                        className={`hidden border-b border-border/40 py-2.5 text-muted-foreground sm:grid ${ROW}`}
                    >
                        <span>Account</span>
                        <span>Plan</span>
                        <span>Tasks used</span>
                        <span />
                    </li>
                    {accounts.map((account) => (
                        <li
                            key={account.user_id}
                            className={`grid gap-y-2 border-b border-border/40 py-3 last:border-b-0 sm:py-2.5 ${ROW}`}
                        >
                            <div className="min-w-0">
                                <p className="truncate">{account.email}</p>
                                {account.username && (
                                    <p className="truncate text-muted-foreground">@{account.username}</p>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-x-1.5 sm:block">
                                <p>{planName(account.plan, plans)}</p>
                                {account.plan_ends_at && (
                                    <p className="text-muted-foreground">until {day(account.plan_ends_at)}</p>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-x-1.5 sm:block">
                                <p className="font-mono tabular-nums">
                                    {account.tasks_limit === null
                                        ? `${account.tasks_used.toLocaleString('en-US')}`
                                        : `${account.tasks_used.toLocaleString('en-US')} of ${account.tasks_limit.toLocaleString('en-US')}`}
                                    <span className="font-sans sm:hidden"> tasks used</span>
                                </p>
                                {account.week_ends_at && (
                                    <p className="text-muted-foreground">resets {day(account.week_ends_at)}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-2 sm:justify-end">
                                {/* The system's own picker: it works by touch, and it never moves the page. */}
                                <select
                                    value=""
                                    disabled={busy || plans.length === 0}
                                    onChange={(event) => {
                                        const plan = plans.find((option) => option.code === event.target.value);
                                        if (plan) setPending({ kind: 'set_plan', account, plan });
                                    }}
                                    aria-label={`Put ${account.email} on a plan`}
                                    className={`${PICKER} flex-1 sm:flex-none`}
                                >
                                    <option value="" disabled>
                                        Set plan
                                    </option>
                                    {plans.map((plan) => (
                                        <option key={plan.code} value={plan.code}>
                                            {plan.name}
                                        </option>
                                    ))}
                                </select>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-9 flex-1 sm:h-8 sm:flex-none"
                                    disabled={busy || account.tasks_used === 0}
                                    onClick={() => resetOne.mutate(account)}
                                    aria-label={`Reset the week for ${account.email}`}
                                >
                                    Reset week
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {log.length > 0 && (
                <div className="border-t border-border/40 px-5 py-3.5">
                    <p className="mb-2 text-xs text-muted-foreground">Recent changes</p>
                    <ul className="space-y-1.5 text-xs">
                        {log.map((entry) => (
                            <li key={entry.id} className="flex flex-col gap-x-4 gap-y-0.5 sm:flex-row sm:justify-between">
                                <span className="min-w-0 break-words">{describe(entry, plans)}</span>
                                <span className="shrink-0 text-muted-foreground">
                                    {entry.admin} · {new Date(entry.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
                <AlertDialogContent onCloseAutoFocus={(event) => event.preventDefault()}>
                    {pending?.kind === 'reset_all' && (
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                Reset the week for {scope === 'all' ? 'everyone' : 'paid plans'}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                {affected === 0
                                    ? 'Nobody has used a task this week, so there is nothing to clear.'
                                    : `${people(affected)} ${affected === 1 ? 'has' : 'have'} used tasks this week and will start again from zero. Plan dates and cost ceilings don’t change. This can’t be undone.`}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                    )}
                    {pending?.kind === 'set_plan' && (
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                Put {pending.account.email} on {pending.plan.name}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                {pending.account.plan === pending.plan.code
                                    ? `They’re already on ${pending.plan.name}, so this adds a month to the end of their plan at no charge.`
                                    : `This gives them a month of ${pending.plan.name} starting now, at no charge, in place of ${planName(pending.account.plan, plans)}.`}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirm} disabled={pending?.kind === 'reset_all' && affected === 0}>
                            {pending?.kind === 'set_plan' ? `Put on ${pending.plan.name}` : 'Reset the week'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </article>
    );
}
