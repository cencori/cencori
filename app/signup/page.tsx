import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthGradient } from "@/components/auth/auth-gradient";
import { SignupForm } from "@/components/signup-form";
import Link from "next/link";
import { createServerClient } from "@/lib/supabaseServer";
import { getSafeSignedInDestination } from "@/lib/auth-redirect";

function SignupPageContent() {
  return (
    <div className="relative min-h-dvh flex flex-col overflow-hidden p-4 md:p-6">
      <AuthGradient />
      <div className="relative z-10 flex-1 flex items-center justify-center">
        <div className="w-full max-w-sm">
          <SignupForm />
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
  );
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    redirect(getSafeSignedInDestination(params?.redirect));
  }
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center">Loading...</div>}>
      <SignupPageContent />
    </Suspense>
  );
}
