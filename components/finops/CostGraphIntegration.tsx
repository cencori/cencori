"use client";

/**
 * CostGraph: send this organization's AI spend to CostGraph as FOCUS 1.2.
 *
 * Two surfaces, the same for every integration:
 *   - CostGraphIntegration: the card on Settings → Integrations. Logo, name, one line, and one
 *     action — Connect, or View connection once connected.
 *   - CostGraphIntegrationPage: the integration's own page (/settings/integrations/costgraph) with
 *     the connection's details and everything you can do to it.
 *
 * The connection belongs to the organization — CostGraph keys usage on the billing account, which
 * is the organization id — so it applies to every project, and owners and admins manage it.
 * Connecting is "Sign in with CostGraph" (OAuth); see lib/finops/costgraph-oauth.ts.
 */

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, ChevronLeft, Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/toast";
import { CardShell } from "@/components/integrations/CardShell";
import {
    cancelCostGraphConnect,
    completeCostGraphConnect,
    deleteCostGraphConnection,
    getUsageExportSettings,
    pushCostGraphNow,
    setCostGraphEnabled,
    type CostGraphConnectionView,
    type UsageExportSettings,
} from "@/app/(app)/[orgSlug]/~/settings/actions";

export const COSTGRAPH = {
    slug: "costgraph",
    name: "CostGraph",
    description: "Cost infrastructure for enterprise teams.",
    category: "FinOps",
    website: "https://costgraph.ai",
    docs: "https://cencori.com/docs/integrations/costgraph",
} as const;

export const SUB_ACCOUNT_OPTIONS = [
    { value: "project", label: "Project", hint: "Each Cencori project is a sub-account." },
    { value: "end_user", label: "End user", hint: "The end user id you send with requests — your customers." },
    { value: "tenant", label: "Tenant", hint: "Embedded-agent tenants." },
    { value: "none", label: "None", hint: "The sub-account column is left empty." },
] as const;

export function usageExportQueryKey(orgSlug: string) {
    return ["usageExportSettings", orgSlug];
}

const CALLBACK_MESSAGES: Record<string, string> = {
    denied: "CostGraph sign-in was cancelled.",
    forbidden: "Only organization owners and admins can connect CostGraph.",
    signed_out: "Sign in to Cencori again, then connect CostGraph.",
    expired: "That CostGraph sign-in took too long. Connect again.",
    no_tenant: "Your CostGraph account has no tenant to send usage to.",
    unsupported: "CostGraph doesn't support connecting from Cencori yet.",
    unavailable: "Connecting CostGraph from Cencori isn't available yet.",
    invalid_scope: "CostGraph didn't allow the permissions Cencori asked for.",
    costgraph_role: "Connecting needs an owner, admin or billing admin role in that CostGraph organization.",
};

/** CostGraph's mark, from their brand assets (public/integrations/costgraph.svg). */
function CostGraphLogo({ size = 18 }: { size?: number }) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/integrations/costgraph.svg" alt="" width={size} height={size} style={{ width: size, height: size }} />;
}

/**
 * Settings URLs for the integration, on whichever host we are: the console's flat routes
 * (/settings/…) or the org/project ones (/{org}/{project}/settings/…).
 */
function useIntegrationPaths(orgSlug: string) {
    const pathname = usePathname() ?? "";
    const segments = pathname.split("/").filter(Boolean);
    const base = segments[0] === orgSlug && segments[1] ? `/${segments[0]}/${segments[1]}/settings` : "/settings";
    return {
        list: `${base}?tab=integrations`,
        page: `${base}/integrations/${COSTGRAPH.slug}`,
    };
}

function useConnection(orgSlug: string) {
    return useQuery<UsageExportSettings>({
        queryKey: usageExportQueryKey(orgSlug),
        queryFn: async () => {
            const result = await getUsageExportSettings(orgSlug);
            if (!result.ok || !result.data) throw new Error(result.error || "Could not load the CostGraph integration");
            return result.data;
        },
        staleTime: 30 * 1000,
    });
}

/** Send the user through "Sign in with CostGraph", coming back to `returnTo`. */
function startConnect(orgSlug: string, returnTo: string) {
    window.location.href = `/api/integrations/costgraph/oauth/start?org=${encodeURIComponent(orgSlug)}&returnTo=${encodeURIComponent(returnTo)}`;
}

/* ---------- The card on Settings → Integrations ---------- */

export function CostGraphIntegration({ orgSlug }: { orgSlug: string }) {
    const { data, isLoading } = useConnection(orgSlug);
    const paths = useIntegrationPaths(orgSlug);
    useCallbackNotice(usageExportQueryKey(orgSlug));

    if (isLoading) return <Skeleton className="h-36 w-full rounded-lg" />;

    const connected = Boolean(data?.costgraph);
    const pending = Boolean(data?.pendingTenants && !connected);
    const available = Boolean(data?.oauthAvailable);

    let action: ReactNode;
    if (connected || pending) {
        action = (
            <Button asChild size="sm" className="h-7 px-3 text-xs">
                <Link href={paths.page}>{pending ? "Finish connecting" : "View connection"}</Link>
            </Button>
        );
    } else {
        action = (
            <>
                <Button size="sm" className="h-7 px-3 text-xs" disabled={!available} onClick={() => startConnect(orgSlug, paths.page)}>
                    Connect
                </Button>
                {!available && (
                    <span className="ml-auto shrink-0 rounded-md border border-border/40 bg-background/25 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        Available soon
                    </span>
                )}
            </>
        );
    }

    return (
        <CardShell
            layout="compact"
            logo={<CostGraphLogo />}
            title={COSTGRAPH.name}
            description={COSTGRAPH.description}
            bottomAction={action}
        />
    );
}

/** Turn the OAuth callback's `?costgraph=` result into a toast, then drop it from the URL. */
function useCallbackNotice(queryKey: string[]) {
    const params = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const queryClient = useQueryClient();
    const result = params.get("costgraph");
    const reason = params.get("reason");

    useEffect(() => {
        if (!result) return;
        if (result === "connected") toast.success("CostGraph connected. Usage is sent nightly.");
        else if (result === "choose_tenant") toast.success("Signed in to CostGraph. Choose the tenant to send usage to.");
        else if (result === "error") toast.error(CALLBACK_MESSAGES[reason ?? ""] ?? "Could not connect CostGraph.");
        void queryClient.invalidateQueries({ queryKey });

        const next = new URLSearchParams(params.toString());
        next.delete("costgraph");
        next.delete("reason");
        router.replace(next.size ? `${pathname}?${next.toString()}` : pathname, { scroll: false });
        // Runs once per callback result.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [result]);
}

/* ---------- The integration's own page ---------- */

const sectionClass = "grid gap-4 border-t border-border/35 py-7 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start lg:gap-9";

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
    return (
        <section className={sectionClass}>
            <div className="space-y-0.5">
                <h2 className="text-sm font-medium">{title}</h2>
                <p className="text-[11px] leading-5 text-muted-foreground">{description}</p>
            </div>
            <div className="min-w-0">{children}</div>
        </section>
    );
}

function Detail({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
    return (
        <div className="flex min-h-12 items-center justify-between gap-6 px-5 py-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <div className={`min-w-0 truncate text-right text-[13px] font-medium ${mono ? "font-mono" : ""}`}>{children}</div>
        </div>
    );
}

function formatWhen(iso: string | null): string {
    if (!iso) return "Never";
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function CostGraphIntegrationPage({ orgSlug }: { orgSlug: string }) {
    const queryKey = usageExportQueryKey(orgSlug);
    const queryClient = useQueryClient();
    const refresh = () => queryClient.invalidateQueries({ queryKey });
    const { data, isLoading, error } = useConnection(orgSlug);
    const paths = useIntegrationPaths(orgSlug);
    useCallbackNotice(queryKey);

    const connection = data?.costgraph ?? null;

    return (
        <main className="w-full max-w-[1180px] mx-auto px-6 lg:px-10 py-12">
            <Link href={paths.list} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ChevronLeft className="size-3.5" />
                Integrations
            </Link>

            <header className="mt-6 flex flex-col gap-5 border-b border-border/35 pb-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                    <CostGraphLogo size={40} />
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-xl font-medium tracking-tight">{COSTGRAPH.name}</h1>
                            <span className="rounded-md border border-border/40 bg-background/25 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                {COSTGRAPH.category}
                            </span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{COSTGRAPH.description}</p>
                        <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
                            <a href={COSTGRAPH.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-foreground">
                                costgraph.ai <ArrowUpRight className="size-3" />
                            </a>
                            <a href={COSTGRAPH.docs} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-foreground">
                                Setup guide <ArrowUpRight className="size-3" />
                            </a>
                        </div>
                    </div>
                </div>
            </header>

            {isLoading ? (
                <div className="space-y-4 pt-7">
                    <Skeleton className="h-40 w-full rounded-lg" />
                    <Skeleton className="h-24 w-full rounded-lg" />
                </div>
            ) : error || !data ? (
                <p className="pt-7 text-xs text-muted-foreground">
                    {error instanceof Error ? error.message : "Could not load the CostGraph integration."}
                </p>
            ) : data.pendingTenants && !connection ? (
                <Section title="Choose a tenant" description="Your CostGraph account has more than one tenant. Pick the one this organization's usage goes to.">
                    <TenantPicker orgSlug={orgSlug} tenants={data.pendingTenants} onDone={refresh} />
                </Section>
            ) : !connection ? (
                <NotConnected orgSlug={orgSlug} available={data.oauthAvailable} returnTo={paths.page} />
            ) : (
                <Connected orgSlug={orgSlug} connection={connection} oauthAvailable={data.oauthAvailable} returnTo={paths.page} listPath={paths.list} onChanged={refresh} />
            )}
        </main>
    );
}

function NotConnected({ orgSlug, available, returnTo }: { orgSlug: string; available: boolean; returnTo: string }) {
    return (
        <Section title="Connection" description="Applies to every project in this organization.">
            <div className="rounded-lg border border-border/35 bg-muted/30 px-5 py-5">
                <p className="max-w-xl text-xs leading-5 text-muted-foreground">
                    Connect to send this organization&apos;s AI spend to CostGraph every night, by model, project and customer, priced at what Cencori billed. You&apos;ll sign in to CostGraph and choose the tenant it goes to.
                </p>
                <div className="mt-4 flex items-center gap-3">
                    <Button size="sm" className="h-7 px-3 text-xs" disabled={!available} onClick={() => startConnect(orgSlug, returnTo)}>
                        Connect
                    </Button>
                    {!available && <span className="text-[11px] text-muted-foreground">Available soon</span>}
                </div>
            </div>
        </Section>
    );
}

function Connected({
    orgSlug,
    connection,
    oauthAvailable,
    returnTo,
    listPath,
    onChanged,
}: {
    orgSlug: string;
    connection: CostGraphConnectionView;
    oauthAvailable: boolean;
    returnTo: string;
    listPath: string;
    onChanged: () => void;
}) {
    const router = useRouter();
    const [confirmDisconnect, setConfirmDisconnect] = useState(false);
    const subAccount = SUB_ACCOUNT_OPTIONS.find((o) => o.value === connection.subAccount);

    const pushNow = useMutation({
        mutationFn: async () => {
            const result = await pushCostGraphNow(orgSlug);
            if (!result.ok) throw new Error(result.error || "The send failed");
            return result.data;
        },
        onSuccess: (view) => {
            toast.success(view && view.sentRows > 0 ? `Sent ${view.sentRows} FOCUS rows to CostGraph.` : "CostGraph is up to date.");
            onChanged();
        },
        onError: (err: Error) => {
            toast.error(err.message);
            onChanged();
        },
    });

    const toggle = useMutation({
        mutationFn: async (enabled: boolean) => {
            const result = await setCostGraphEnabled(orgSlug, enabled);
            if (!result.ok) throw new Error(result.error || "Could not update");
        },
        onSuccess: onChanged,
        onError: (err: Error) => toast.error(err.message),
    });

    const disconnect = useMutation({
        mutationFn: async () => {
            const result = await deleteCostGraphConnection(orgSlug);
            if (!result.ok) throw new Error(result.error || "Could not disconnect");
        },
        onSuccess: () => {
            toast.success("CostGraph disconnected.");
            onChanged();
            router.push(listPath);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    return (
        <>
            <Section title="Connection" description="Applies to every project in this organization.">
                <div className="overflow-hidden rounded-lg border border-border/35 bg-muted/30 divide-y divide-border/30">
                    <Detail label="Connected with">
                        {connection.authMethod === "oauth" ? "CostGraph sign-in" : `API key ${connection.apiKeyHint ?? ""}`}
                    </Detail>
                    {connection.tenantName && <Detail label="CostGraph tenant">{connection.tenantName}</Detail>}
                    <Detail label="Connection" mono>{connection.connectionId ?? "Not created yet"}</Detail>
                    <Detail label="Sub-account">
                        <span className="inline-flex items-center gap-1.5">
                            {subAccount?.label ?? connection.subAccount}
                            {connection.lastPushedDay && <Lock className="size-3 text-muted-foreground" aria-label="Fixed" />}
                        </span>
                    </Detail>
                </div>
                {connection.lastPushedDay && (
                    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                        The sub-account is fixed once usage has been sent: CostGraph keeps every record it receives, so changing it would count history twice.
                    </p>
                )}
            </Section>

            <Section title="Sending" description="Each UTC day is sent once it closes; from the 3rd, the previous month is re-sent so late usage corrects itself.">
                <div className="overflow-hidden rounded-lg border border-border/35 bg-muted/30 divide-y divide-border/30">
                    <Detail label="Sent through" mono>{connection.lastPushedDay ?? "Nothing sent yet"}</Detail>
                    <Detail label="Last attempt">{formatWhen(connection.lastRunAt)}</Detail>
                    <div className="flex min-h-12 items-center justify-between gap-6 px-5 py-3">
                        <Label htmlFor="cg-enabled" className="text-xs font-normal text-muted-foreground">Send nightly</Label>
                        <Switch
                            id="cg-enabled"
                            checked={connection.enabled}
                            disabled={toggle.isPending}
                            onCheckedChange={(enabled) => toggle.mutate(enabled)}
                        />
                    </div>
                    {connection.lastRunStatus === "error" && connection.lastRunError && (
                        <div className="px-5 py-3">
                            <p className="text-[11px] text-muted-foreground">Last send failed</p>
                            <p className="mt-1 break-words font-mono text-[11px] leading-5 text-destructive">{connection.lastRunError}</p>
                        </div>
                    )}
                </div>
                <div className="mt-4">
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-3 text-xs"
                        disabled={pushNow.isPending || !connection.enabled || !connection.connectionId}
                        onClick={() => pushNow.mutate()}
                    >
                        <Send className="mr-1.5 size-3" />
                        {pushNow.isPending ? "Sending…" : "Send now"}
                    </Button>
                </div>
            </Section>

            <Section title="Manage" description="Reconnect to sign in to CostGraph again. Disconnecting stops the nightly send; what CostGraph already has stays there.">
                <div className="flex flex-wrap gap-2">
                    {oauthAvailable && (
                        <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={() => startConnect(orgSlug, returnTo)}>
                            {connection.authMethod === "oauth" ? "Reconnect" : "Switch to CostGraph sign-in"}
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-3 text-xs text-destructive hover:text-destructive"
                        onClick={() => setConfirmDisconnect(true)}
                    >
                        Disconnect
                    </Button>
                </div>
            </Section>

            <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect CostGraph?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cencori stops sending usage to CostGraph for every project in this organization. Usage CostGraph already received stays there.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => disconnect.mutate()}>Disconnect</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

function TenantPicker({
    orgSlug,
    tenants,
    onDone,
}: {
    orgSlug: string;
    tenants: Array<{ id: string; name: string }>;
    onDone: () => void;
}) {
    const [tenantId, setTenantId] = useState(tenants[0]?.id ?? "");
    const complete = useMutation({
        mutationFn: async () => {
            const result = await completeCostGraphConnect(orgSlug, tenantId);
            if (!result.ok) throw new Error(result.error || "Could not connect CostGraph");
        },
        onSuccess: () => {
            toast.success("CostGraph connected. Usage is sent nightly.");
            onDone();
        },
        onError: (err: Error) => {
            toast.error(err.message);
            onDone();
        },
    });
    const cancel = useMutation({
        mutationFn: async () => { await cancelCostGraphConnect(orgSlug); },
        onSuccess: onDone,
    });

    return (
        <div className="space-y-3 rounded-lg border border-border/35 bg-muted/30 px-5 py-5">
            <Select value={tenantId} onValueChange={setTenantId}>
                <SelectTrigger className="h-8 max-w-sm text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                    {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id} className="text-xs">{tenant.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <div className="flex gap-2">
                <Button size="sm" className="h-7 px-3 text-xs" disabled={!tenantId || complete.isPending} onClick={() => complete.mutate()}>
                    {complete.isPending ? "Connecting…" : "Connect"}
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-3 text-xs" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
                    Cancel
                </Button>
            </div>
        </div>
    );
}
