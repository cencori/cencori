import { Suspense } from "react";
import { SignupForm } from "@/components/signup-form";
import { Logo } from "@/components/logo";
import Link from "next/link";

function SignupPageContent() {
  return (
    <div className="min-h-svh flex items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="flex justify-center">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <Logo variant="full" className="h-6" />
          </Link>
        </div>
        <div className="w-full">
          <SignupForm />
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-svh flex items-center justify-center">Loading...</div>}>
      <SignupPageContent />
    </Suspense>
  );
}
