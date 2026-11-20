"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ScopeGroup } from "@/lib/oauth/scopes";

type ConsentFormProps = {
  appName: string;
  clientId: string;
  codeChallenge: string;
  organizations: Array<{ id: string; name: string; allowed: boolean }>;
  permissions: ScopeGroup[];
  redirectUri: string;
  scope: string;
  state: string | undefined;
  /** The request includes creating API keys, which only an organization's owner can give. */
  needsOwner: boolean;
  /** A made-up app shown in development to look at the design. The buttons do nothing. */
  preview?: boolean;
};

type Answer = { redirect_url?: string; login_url?: string; error?: string };

export function ConsentForm(props: ConsentFormProps) {
  const choosable = props.organizations.filter((organization) => organization.allowed);
  const [organizationId, setOrganizationId] = useState(choosable.length === 1 ? choosable[0].id : "");
  const [pending, setPending] = useState<"allow" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailed, setDetailed] = useState(false);
  // One row for each level, as "Projects, API keys": what can be changed first, then what can only be read.
  const levels = (["write", "read"] as const)
    .map((level) => ({
      level,
      labels: props.permissions.filter((permission) => permission.level === level).map((permission) => permission.label),
    }))
    .filter((group) => group.labels.length > 0);

  async function decide(decision: "allow" | "deny") {
    if (props.preview) {
      setError("This is a preview with a made-up app. Nothing was authorized.");
      return;
    }
    setError(null);
    setPending(decision);
    try {
      const response = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: props.clientId,
          redirect_uri: props.redirectUri,
          scope: props.scope,
          state: props.state,
          code_challenge: props.codeChallenge,
          organization_id: decision === "allow" ? organizationId : undefined,
          decision,
        }),
      });
      const answer = (await response.json()) as Answer;
      const next = answer.redirect_url ?? answer.login_url;
      if (next) {
        // Stay disabled: the browser is leaving for the app.
        window.location.assign(next);
        return;
      }
      setError(answer.error ?? "Cencori could not complete the authorization.");
      setPending(null);
    } catch {
      setError("Cencori could not be reached. Check your connection and try again.");
      setPending(null);
    }
  }

  return (
    <div className="mt-6">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground" htmlFor="oauth-organization">
        Organization
      </Label>
      {choosable.length === 0 ? (
        <p className="mt-2 rounded-lg border border-border px-3 py-2 text-sm leading-6 text-muted-foreground">
          {props.needsOwner
            ? "This app asks to create API keys, which only an organization's owner can allow. You don't own an organization on this account."
            : "You need to be an owner or admin of an organization to give an app access to it."}
        </p>
      ) : (
        <Select disabled={pending !== null} onValueChange={setOrganizationId} value={organizationId}>
          <SelectTrigger className="mt-2 w-full" id="oauth-organization">
            <SelectValue placeholder="Select an organization" />
          </SelectTrigger>
          <SelectContent>
            {props.organizations.map((organization) => (
              <SelectItem disabled={!organization.allowed} key={organization.id} value={organization.id}>
                {organization.name}
                {organization.allowed ? "" : " (owner only)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <p className="mt-5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Permissions</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {props.appName} will be able to do the following in the organization you choose, and nothing else.
      </p>
      <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
        {levels.map((group) => (
          <li className="flex items-center justify-between gap-3 px-3 py-2.5" key={group.level}>
            <span className="text-sm font-medium">{group.labels.join(", ")}</span>
            <span
              className={
                group.level === "write"
                  ? "shrink-0 rounded-full border border-amber-500/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300"
                  : "shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
              }
            >
              {group.level === "write" ? "Read + write" : "Read"}
            </span>
          </li>
        ))}
      </ul>

      <button
        aria-expanded={detailed}
        className="mx-auto mt-3 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => setDetailed((open) => !open)}
        type="button"
      >
        {detailed ? "Hide detailed permissions" : "Show detailed permissions"}
        <ChevronDown
          aria-hidden="true"
          className={detailed ? "size-3.5 rotate-180 transition-transform" : "size-3.5 transition-transform"}
        />
      </button>
      {detailed ? (
        <ul className="mt-3 space-y-2.5">
          {props.permissions.map((permission) => (
            <li key={permission.resource}>
              <p className="text-xs font-medium">{permission.label}</p>
              <p className="text-xs leading-5 text-muted-foreground">{permission.description}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        className="mt-5 w-full"
        disabled={pending !== null || !organizationId}
        onClick={() => decide("allow")}
        type="button"
      >
        {pending === "allow" ? "Authorizing…" : `Authorize ${props.appName}`}
      </Button>
      <Button
        className="mt-2 w-full"
        disabled={pending !== null}
        onClick={() => decide("deny")}
        type="button"
        variant="ghost"
      >
        Cancel
      </Button>
    </div>
  );
}
