"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import { resolveAuthRedirectTargets } from "@/lib/auth-redirect";
import { clearSignupWelcomeEmailPending, markSignupWelcomeEmailPending } from "@/lib/auth-welcome";
import Link from "next/link";

type LoginFormProps = React.ComponentProps<"form">;

export function LoginForm({ className, ...props }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ssoInfo, setSsoInfo] = useState<{ sso: boolean; enforce?: boolean; organization?: string; domain?: string } | null>(null);
  const [checkingSSO, setCheckingSSO] = useState(false);

  // Check if email domain has SSO configured
  const checkSSO = async (email: string) => {
    const domain = email.split("@")[1];
    if (!domain || domain.length < 3) {
      setSsoInfo(null);
      return;
    }
    setCheckingSSO(true);
    try {
      const res = await fetch("/api/auth/sso/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setSsoInfo(data);
    } catch {
      setSsoInfo(null);
    }
    setCheckingSSO(false);
  };

  const handleSSOLogin = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      const domain = email.split("@")[1];
      const { error: ssoError } = await supabase.auth.signInWithSSO({ domain });
      if (ssoError) {
        setError(ssoError.message);
        setLoading(false);
      }
      // Supabase handles the redirect
    } catch (err) {
      setError(err instanceof Error ? err.message : "SSO login failed");
      setLoading(false);
    }
  };

  const navigateAfterAuth = (target: string) => {
    if (/^https?:\/\//i.test(target)) {
      window.location.assign(target);
      return;
    }
    router.push(target);
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();

    if (!email) {
      setError("Please provide a valid email.");
      setLoading(false);
      return;
    }

    // If SSO is enforced for this domain, redirect to SSO
    if (ssoInfo?.sso && ssoInfo.enforce) {
      await handleSSOLogin(email);
      return;
    }

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
      // If login returned a session, redirect to the specified URL or dashboard
      const { navigationTarget } = resolveAuthRedirectTargets(redirectParam, {
        defaultPath: "/dashboard/organizations",
      });
      if (data?.session) {
        navigateAfterAuth(navigationTarget);
        return;
      }

      navigateAfterAuth(navigationTarget);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      setError(msg);
      setLoading(false)
    } finally {
      setLoading(false);
    }
  }
  async function handleOAuth(provider: "github" | "google") {
    setError(null);
    setLoading(true);
    try {
      const { oauthRedirectTo } = resolveAuthRedirectTargets(redirectParam, {
        defaultPath: "/dashboard/organizations",
      });

      // OAuth on login can still create a brand-new account; mark pending so welcome email can fire post-auth.
      markSignupWelcomeEmailPending();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: oauthRedirectTo },
      });
      if (oauthError) {
        clearSignupWelcomeEmailPending();
        setError(oauthError.message);
        setLoading(false);
      }
      // Supabase handles the redirect for OAuth; we don't navigate here.
    } catch (err) {
      clearSignupWelcomeEmailPending();
      const message = err instanceof Error ? err.message : "OAuth failed";
      setError(message);
      setLoading(false);
    }
  }

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Login to your account</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Enter your email below to login to your account
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded p-2 text-sm text-red-700 bg-red-50">
            {error}
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="bola@example.com"
            required
            onBlur={(e) => checkSSO(e.target.value)}
          />
        </Field>

        {/* SSO detected banner */}
        {ssoInfo?.sso && (
          <div className="rounded-md border border-blue-500/30 bg-blue-500/5 px-3 py-2.5">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
              SSO is {ssoInfo.enforce ? "required" : "available"} for {ssoInfo.organization}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {ssoInfo.enforce
                ? "Your organization requires SSO login. Click below to continue."
                : "You can log in with SSO or use your password."}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 h-7 text-xs gap-1.5 w-full"
              onClick={() => {
                const emailInput = document.getElementById("email") as HTMLInputElement;
                if (emailInput?.value) handleSSOLogin(emailInput.value);
              }}
              disabled={loading}
            >
              {loading ? "Redirecting..." : `Log in with ${ssoInfo.organization} SSO`}
            </Button>
          </div>
        )}

        {(!ssoInfo?.enforce) && (
          <>
            <Field>
              <div className="flex items-center">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <a
                  href="/forgot"
                  className="ml-auto text-sm underline-offset-4 hover:underline"
                  aria-label="Forgot password"
                >
                  Forgot your password?
                </a>
              </div>
              <Input id="password" name="password" type="password" />
            </Field>

            <Field>
              <Button type="submit" disabled={loading}>
                {loading ? "Working…" : "Login"}
              </Button>
            </Field>
          </>
        )}

        <FieldSeparator>Or continue with</FieldSeparator>

        <Field className="flex flex-col gap-3">
          <Button
            variant="outline"
            type="button"
            onClick={() => void handleOAuth("github")}
            disabled={loading}
          >
            <svg className="mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
              <path
                d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                fill="currentColor"
              />
            </svg>
            GitHub
          </Button>

          <Button
            variant="outline"
            type="button"
            onClick={() => void handleOAuth("google")}
            disabled={loading}
          >
            {/* Google icon */}
            <svg className="mr-2" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.29 1.46 8.18 2.69l6-5.84C34.28 3.64 29.52 2 24 2 14.64 2 6.61 7.86 3.24 15.81l7.36 5.72C12.23 14.55 17.56 9.5 24 9.5z" />
              <path fill="#34A853" d="M46.14 24.5c0-1.62-.15-3.18-.42-4.69H24v9.01h12.55a10.78 10.78 0 0 1-4.68 7.09l7.36 5.7C43.62 37.1 46.14 31.3 46.14 24.5z" />
              <path fill="#4A90E2" d="M10.6 28.49a14.32 14.32 0 0 1 0-8.98l-7.36-5.7A23.94 23.94 0 0 0 0 24c0 3.9.94 7.58 2.6 10.89l7.36-5.7z" />
              <path fill="#FBBC05" d="M24 46c5.52 0 10.16-1.82 13.55-4.94l-7.36-5.7C28.1 36.3 26.13 37 24 37a13.46 13.46 0 0 1-12.4-8.51l-7.36 5.7C6.61 40.14 14.64 46 24 46z" />
            </svg>
            Google
          </Button>

          <FieldDescription className="text-center">
            Don&apos;t have an account?{" "}
            <Link
              href={redirectParam ? `/signup?redirect=${encodeURIComponent(redirectParam)}` : "/signup"}
              className="underline underline-offset-4"
            >
              Sign up
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
