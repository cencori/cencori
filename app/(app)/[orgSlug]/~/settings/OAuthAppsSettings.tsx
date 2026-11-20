"use client";

/**
 * OAuth apps: the apps this organization registered to ask people for access to their Cencori
 * organizations, and the apps that have access to this one (lib/oauth, /docs/oauth).
 */

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppWindow, Check, Copy, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { CardShell } from "@/components/integrations/CardShell";
import { OAUTH_SCOPES, describeScopes } from "@/lib/oauth/scopes";
import type { OAuthApp } from "@/lib/oauth/store";
import {
    createOAuthApp,
    deleteOAuthApp,
    getOAuthSettings,
    revokeOAuthGrant,
    rotateOAuthAppSecret,
    updateOAuthApp,
    type OAuthAppForm,
    type OAuthSettings,
} from "./oauth-actions";

const SCOPE_LABELS: Record<string, { label: string; hint: string }> = {
    "organization:read": { label: "Organization: read", hint: "Name, plan and number of members." },
    "projects:read": { label: "Projects: read", hint: "See the organization's projects." },
    "projects:write": { label: "Projects: write", hint: "Create and rename projects." },
    "api_keys:read": { label: "API keys: read", hint: "See which keys exist, not their values." },
    "api_keys:write": { label: "API keys: write", hint: "Create and revoke keys. Only an owner can grant this." },
    "usage:read": { label: "Usage: read", hint: "Requests, tokens and cost." },
};

const EMPTY_FORM: OAuthAppForm = { name: "", description: "", websiteUrl: "", redirectUris: [], scopes: ["organization:read", "projects:read"] };

function formFor(app: OAuthApp): OAuthAppForm {
    return {
        name: app.name,
        description: app.description ?? "",
        websiteUrl: app.website_url ?? "",
        redirectUris: app.redirect_uris,
        scopes: app.scopes,
    };
}

function CopyField({ label, value }: { label: string; value: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <div className="space-y-1.5">
            <Label className="text-xs">{label}</Label>
            <div className="flex items-center gap-2">
                <Input readOnly value={value} className="h-8 font-mono text-xs" />
                <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2"
                    aria-label={`Copy ${label.toLowerCase()}`}
                    onClick={async () => {
                        await navigator.clipboard.writeText(value);
                        setCopied(true);
                    }}
                >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
            </div>
        </div>
    );
}

export function OAuthAppsSettings({ orgSlug }: { orgSlug: string }) {
    const queryKey = ["org-oauth", orgSlug];
    const queryClient = useQueryClient();
    const { data, isLoading, error } = useQuery<OAuthSettings>({
        queryKey,
        queryFn: async () => {
            const result = await getOAuthSettings(orgSlug);
            if (!result.ok || !result.data) throw new Error(result.error || "Could not load OAuth apps");
            return result.data;
        },
        staleTime: 30 * 1000,
    });

    // The app being edited, "new" for the create form, or null when the dialog is closed.
    const [editing, setEditing] = useState<OAuthApp | "new" | null>(null);
    const [form, setForm] = useState<OAuthAppForm>(EMPTY_FORM);
    const [redirectText, setRedirectText] = useState("");
    // A secret just issued, shown once.
    const [secret, setSecret] = useState<{ app: OAuthApp; clientSecret: string } | null>(null);
    const [confirm, setConfirm] = useState<{ kind: "delete" | "rotate"; app: OAuthApp } | null>(null);

    const refresh = () => void queryClient.invalidateQueries({ queryKey });

    const openForm = (app: OAuthApp | "new") => {
        const next = app === "new" ? EMPTY_FORM : formFor(app);
        setForm(next);
        setRedirectText(next.redirectUris.join("\n"));
        setEditing(app);
    };

    const save = useMutation({
        mutationFn: async () => {
            const payload = { ...form, redirectUris: redirectText.split("\n").map((line) => line.trim()).filter(Boolean) };
            if (editing === "new") {
                const result = await createOAuthApp(orgSlug, payload);
                if (!result.ok || !result.data) throw new Error(result.error || "Could not create the app");
                return { created: result.data };
            }
            if (!editing) throw new Error("Nothing to save");
            const result = await updateOAuthApp(orgSlug, editing.id, payload);
            if (!result.ok) throw new Error(result.error || "Could not save the app");
            return { created: null };
        },
        onSuccess: ({ created }) => {
            setEditing(null);
            if (created) setSecret(created);
            else toast.success("OAuth app saved.");
            refresh();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const confirmed = useMutation({
        mutationFn: async (target: { kind: "delete" | "rotate"; app: OAuthApp }) => {
            if (target.kind === "delete") {
                const result = await deleteOAuthApp(orgSlug, target.app.id);
                if (!result.ok) throw new Error(result.error || "Could not delete the app");
                return null;
            }
            const result = await rotateOAuthAppSecret(orgSlug, target.app.id);
            if (!result.ok || !result.data) throw new Error(result.error || "Could not replace the secret");
            return result.data;
        },
        onSuccess: (rotated, target) => {
            setConfirm(null);
            if (rotated) setSecret(rotated);
            else toast.success(`${target.app.name} deleted.`);
            refresh();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const revoke = useMutation({
        mutationFn: async (grantId: string) => {
            const result = await revokeOAuthGrant(orgSlug, grantId);
            if (!result.ok) throw new Error(result.error || "Could not remove access");
        },
        onSuccess: () => {
            toast.success("Access removed.");
            refresh();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    if (isLoading) return <Skeleton className="h-64 w-full rounded-lg" />;
    if (error || !data) {
        return (
            <div className="rounded-lg border border-border/35 bg-muted/30 px-5 py-4 text-xs text-muted-foreground">
                {error instanceof Error ? error.message : "Could not load OAuth apps."}
            </div>
        );
    }

    const toggleScope = (scope: string, on: boolean) =>
        setForm((current) => ({
            ...current,
            scopes: on ? [...new Set([...current.scopes, scope])] : current.scopes.filter((item) => item !== scope),
        }));

    return (
        <div className="space-y-4">
            <CardShell
                icon={AppWindow}
                title="Your OAuth apps"
                description="Register an app to ask Cencori users for access to their organizations. They see what you ask for, choose an organization, and your app gets a token limited to it."
                action={
                    <Button size="sm" className="h-7 self-start px-3 text-xs" onClick={() => openForm("new")}>
                        New app
                    </Button>
                }
                footer={
                    <>
                        How to build with it:{" "}
                        <Link className="underline underline-offset-2" href="/docs/oauth" target="_blank">
                            Cencori OAuth docs
                        </Link>
                        .
                    </>
                }
            >
                <div className="divide-y divide-border/30 border-t border-border/30">
                    {data.apps.length === 0 ? (
                        <p className="px-5 py-4 text-xs text-muted-foreground">No OAuth apps yet.</p>
                    ) : (
                        data.apps.map((app) => (
                            <div key={app.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    {app.logo_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img alt="" src={app.logo_url} className="size-8 shrink-0 rounded-md border border-border/40 bg-white object-contain p-1" />
                                    ) : (
                                        <div aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-md bg-foreground text-xs font-semibold text-background">
                                            {app.name.slice(0, 1).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                    <p className="truncate text-[13px] font-medium">
                                        {app.name}
                                    </p>
                                    <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                                        {app.client_id} · secret ending {app.client_secret_last_four}
                                    </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openForm(app)}>
                                        Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setConfirm({ kind: "rotate", app })}>
                                        New secret
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                        onClick={() => setConfirm({ kind: "delete", app })}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardShell>

            <CardShell
                icon={ShieldCheck}
                title="Apps with access to this organization"
                description="Apps that someone in this organization authorized. Removing access stops the app's tokens at once."
            >
                <div className="divide-y divide-border/30 border-t border-border/30">
                    {data.grants.length === 0 ? (
                        <p className="px-5 py-4 text-xs text-muted-foreground">No apps have access.</p>
                    ) : (
                        data.grants.map((grant) => (
                            <div key={grant.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                                <div className="min-w-0">
                                    <p className="truncate text-[13px] font-medium">
                                        {grant.app_name}
                                    </p>
                                    <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                                        {describeScopes(grant.scopes)
                                            .map((group) => `${group.label}: ${group.level === "write" ? "read and write" : "read"}`)
                                            .join(" · ")}
                                    </p>
                                    <p className="text-[11px] leading-5 text-muted-foreground">
                                        Authorized by {grant.user_email ?? "a member"} on {new Date(grant.created_at).toLocaleDateString()} ·{" "}
                                        {grant.last_used_at ? `last used ${new Date(grant.last_used_at).toLocaleDateString()}` : "never used"}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                    disabled={revoke.isPending}
                                    onClick={() => revoke.mutate(grant.id)}
                                >
                                    Remove access
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </CardShell>

            {/* Create or edit */}
            <Dialog open={editing !== null} onOpenChange={(open) => (open ? null : setEditing(null))}>
                <DialogContent className="max-h-[90dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-sm">{editing === "new" ? "New OAuth app" : "Edit OAuth app"}</DialogTitle>
                        <DialogDescription className="text-xs leading-5">
                            People see the name on the screen where they decide whether to authorize your app.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="min-w-0 space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="oauth-app-name" className="text-xs">Name</Label>
                            <Input
                                id="oauth-app-name"
                                value={form.name}
                                maxLength={60}
                                placeholder="Acme Deploy"
                                onChange={(event) => setForm({ ...form, name: event.target.value })}
                                className="h-8 text-xs"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="oauth-app-description" className="text-xs">Description (optional)</Label>
                            <Input
                                id="oauth-app-description"
                                value={form.description}
                                maxLength={200}
                                placeholder="Sets up Cencori for apps deployed on Acme."
                                onChange={(event) => setForm({ ...form, description: event.target.value })}
                                className="h-8 text-xs"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="oauth-app-website" className="text-xs">Website (optional)</Label>
                            <Input
                                id="oauth-app-website"
                                value={form.websiteUrl}
                                maxLength={300}
                                placeholder="https://acme.example"
                                onChange={(event) => setForm({ ...form, websiteUrl: event.target.value })}
                                className="h-8 text-xs"
                            />
                            <p className="text-[11px] leading-5 text-muted-foreground">
                                Your app&apos;s logo is taken from this site&apos;s icon. Without a website, people see the first letter of the name.
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="oauth-app-redirects" className="text-xs">Redirect addresses</Label>
                            <Textarea
                                id="oauth-app-redirects"
                                value={redirectText}
                                rows={3}
                                placeholder={"https://acme.example/oauth/callback\nhttp://localhost:3000/oauth/callback"}
                                onChange={(event) => setRedirectText(event.target.value)}
                                className="[field-sizing:fixed] min-w-0 resize-y break-all font-mono text-xs"
                            />
                            <p className="text-[11px] leading-5 text-muted-foreground">
                                One on each line. Must be https://, or http:// on localhost. Cencori only sends people back to an address listed here, matched exactly.
                            </p>
                        </div>
                        <fieldset className="space-y-2">
                            <legend className="text-xs font-medium">Permissions your app can ask for</legend>
                            {OAUTH_SCOPES.map((scope) => (
                                <label key={scope} className="flex items-start gap-2.5 text-xs">
                                    <Checkbox
                                        className="mt-0.5"
                                        checked={form.scopes.includes(scope)}
                                        onCheckedChange={(checked) => toggleScope(scope, checked === true)}
                                    />
                                    <span>
                                        <span className="font-medium">{SCOPE_LABELS[scope].label}</span>
                                        <span className="block text-[11px] leading-5 text-muted-foreground">{SCOPE_LABELS[scope].hint}</span>
                                    </span>
                                </label>
                            ))}
                            {editing !== "new" && editing ? (
                                <p className="text-[11px] leading-5 text-muted-foreground">
                                    Unticking a permission also takes it from everyone who already authorized this app.
                                </p>
                            ) : null}
                        </fieldset>
                    </div>
                    <DialogFooter>
                        <Button size="sm" variant="ghost" className="h-7 px-3 text-xs" onClick={() => setEditing(null)}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            className="h-7 px-3 text-xs"
                            disabled={save.isPending || !form.name.trim() || !redirectText.trim() || form.scopes.length === 0}
                            onClick={() => save.mutate()}
                        >
                            {save.isPending ? "Saving…" : editing === "new" ? "Create app" : "Save changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* The secret, once */}
            <Dialog open={secret !== null} onOpenChange={(open) => (open ? null : setSecret(null))}>
                <DialogContent className="grid-cols-[minmax(0,1fr)] sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-sm">Copy the client secret for {secret?.app.name}</DialogTitle>
                        <DialogDescription className="text-xs leading-5">
                            This is the only time the secret is shown. Keep it on your server; never put it in a browser or a mobile app.
                        </DialogDescription>
                    </DialogHeader>
                    {secret ? (
                        <div className="space-y-3">
                            <CopyField label="Client ID" value={secret.app.client_id} />
                            <CopyField label="Client secret" value={secret.clientSecret} />
                        </div>
                    ) : null}
                    <DialogFooter>
                        <Button size="sm" className="h-7 px-3 text-xs" onClick={() => setSecret(null)}>Done</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete or replace the secret */}
            <Dialog open={confirm !== null} onOpenChange={(open) => (open ? null : setConfirm(null))}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-sm">
                            {confirm?.kind === "delete" ? `Delete ${confirm.app.name}?` : `Replace the secret for ${confirm?.app.name}?`}
                        </DialogTitle>
                        <DialogDescription className="text-xs leading-5">
                            {confirm?.kind === "delete"
                                ? "Everyone who authorized this app loses the connection, and its tokens stop working at once. This cannot be undone."
                                : "The current secret stops working at once. Your app cannot get or refresh tokens until you give it the new one. Tokens already issued keep working."}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button size="sm" variant="ghost" className="h-7 px-3 text-xs" onClick={() => setConfirm(null)}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            variant={confirm?.kind === "delete" ? "destructive" : "default"}
                            className="h-7 px-3 text-xs"
                            disabled={confirmed.isPending}
                            onClick={() => confirm && confirmed.mutate(confirm)}
                        >
                            {confirmed.isPending ? "Working…" : confirm?.kind === "delete" ? "Delete app" : "Replace secret"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
