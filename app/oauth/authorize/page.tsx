import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { Logo } from "@/components/logo";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerClient } from "@/lib/supabaseServer";
import {
  authorizePath,
  checkAuthorizeRequest,
  type AuthorizeParams,
  type AuthorizeRequest,
} from "@/lib/oauth/authorize";
import { describeScopes, formatScopes } from "@/lib/oauth/protocol";
import { grantableOrganizations, roleMayGrant } from "@/lib/oauth/store";
import { ConsentForm } from "./consent-form";

export const metadata: Metadata = {
  title: "Authorize an app",
  robots: { index: false, follow: false },
};

const PREVIEW_REQUEST: AuthorizeRequest = {
  app: {
    id: "preview",
    organization_id: "preview",
    name: "Acme Deploy",
    description: "Sets up Cencori for the apps you deploy on Acme.",
    website_url: "https://acme.example",
    client_id: "coa_000000000000000000000000",
    client_secret_last_four: "0000",
    redirect_uris: ["https://acme.example/oauth/callback"],
    scopes: ["organization:read", "projects:write", "api_keys:write", "usage:read"],
    verified: false,
    created_at: "",
    updated_at: "",
  },
  redirectUri: "https://acme.example/oauth/callback",
  scopes: ["organization:read", "projects:write", "api_keys:write", "usage:read"],
  state: undefined,
  codeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
};

type AuthorizePageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * /oauth/authorize — where an app sends a person to ask for access to a Cencori organization.
 *
 * Shows who is asking, what for and where the answer goes, and lets the person choose which
 * organization. Nothing is granted by opening this page: only the Authorize button does that.
 */
export default async function AuthorizePage({ searchParams }: AuthorizePageProps) {
  const raw = await searchParams;
  const one = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string) : undefined);
  const params: AuthorizeParams = {
    response_type: one("response_type"),
    client_id: one("client_id"),
    redirect_uri: one("redirect_uri"),
    scope: one("scope"),
    state: one("state"),
    code_challenge: one("code_challenge"),
    code_challenge_method: one("code_challenge_method"),
  };

  const db = createAdminClient();
  // Development only: /oauth/authorize?preview=1 shows the screen for a made-up app, to look at
  // the design without registering one. Its buttons do nothing, and it is not built into production.
  const preview = process.env.NODE_ENV !== "production" && one("preview") === "1";
  let request: AuthorizeRequest;
  if (preview) {
    request = PREVIEW_REQUEST;
  } else {
    const check = await checkAuthorizeRequest(db, params);
    if (check.kind === "stop") return <Stopped message={check.message} />;
    if (check.kind === "redirect") redirect(check.url);
    request = check.request;
  }
  const { app, redirectUri, scopes, state, codeChallenge } = request;

  const supabase = await createServerClient();
  const { data } = await getAuthUser(supabase);
  const user = data.user;
  if (!user) {
    const returnTo = preview ? "/oauth/authorize?preview=1" : authorizePath(params);
    redirect(`/login?redirect=${encodeURIComponent(returnTo)}`);
  }

  const organizations = (await grantableOrganizations(db, user.id)).map((organization) => ({
    id: organization.id,
    name: organization.name,
    allowed: roleMayGrant(organization.role, scopes),
  }));

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-5 py-10 text-foreground">
      <section className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3">
          <div
            aria-hidden="true"
            className="grid h-11 w-11 place-items-center rounded-lg bg-foreground text-base font-semibold text-background"
          >
            {app.name.slice(0, 1).toUpperCase()}
          </div>
          <span aria-hidden="true" className="text-muted-foreground">
            ⇄
          </span>
          <div className="grid h-11 w-11 place-items-center rounded-lg border border-border bg-background">
            <Logo variant="mark" className="h-5" />
          </div>
        </div>

        <h1 className="mt-5 text-center text-lg font-semibold tracking-tight">Authorize {app.name}</h1>
        <p className="mt-1 text-center text-sm leading-6 text-muted-foreground">
          This app wants to access your Cencori account.
        </p>
        {app.description ? (
          <p className="mt-3 text-center text-sm leading-6 text-muted-foreground">{app.description}</p>
        ) : null}

        {app.verified ? null : (
          <p
            className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-700 dark:text-amber-300"
            role="note"
          >
            Cencori has not verified who runs this app. Only continue if you trust it.
          </p>
        )}

        <ConsentForm
          appName={app.name}
          clientId={app.client_id}
          codeChallenge={codeChallenge}
          organizations={organizations}
          permissions={describeScopes(scopes)}
          redirectUri={redirectUri}
          scope={formatScopes(scopes)}
          state={state}
          needsOwner={scopes.includes("api_keys:write")}
          preview={preview}
        />
      </section>
    </main>
  );
}

function Stopped({ message }: { message: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-5 text-foreground">
      <section className="w-full max-w-sm text-center">
        <div className="mb-6 flex justify-center">
          <Logo variant="mark" className="h-7" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">This authorization link isn&apos;t valid</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Go back to the app and try again. If it keeps happening, tell the app&apos;s developer.
        </p>
      </section>
    </main>
  );
}
