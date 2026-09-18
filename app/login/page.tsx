import { Suspense } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AuthGradient } from "@/components/auth/auth-gradient";
import { LoginForm } from "@/components/login-form"
import Link from "next/link"
import { createServerClient } from "@/lib/supabaseServer";
import { getConsoleOrigin, getPostLoginDefault, getSafeSignedInDestination } from "@/lib/auth-redirect";

function LoginPageContent() {
  return (
    <div className="relative min-h-dvh flex flex-col overflow-hidden p-4 md:p-6">
      <AuthGradient />
      <div className="relative z-10 flex-1 flex items-center justify-center">
        <div className="w-full max-w-sm">
          <LoginForm />
        </div>
      </div>
      <div className="relative z-10 shrink-0 text-center pb-2">
        <p className="text-xs text-muted-foreground">
          By creating an account, you agree to our{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            Terms of Service
          </Link>.
        </p>
      </div>
    </div>
  )
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;
  if (data.user) {
    redirect(getSafeSignedInDestination(params?.redirect, getPostLoginDefault(origin)));
  }
  // Bare login on a main-app host starts on the console host instead, so the
  // whole flow (form, callback, cookies) lives where the session is used.
  // Explicit ?redirect= targets are honored as-is.
  if (!params?.redirect) {
    const consoleOrigin = getConsoleOrigin(origin);
    if (consoleOrigin) {
      redirect(`${consoleOrigin}/login`);
    }
  }
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center">Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  )
}
