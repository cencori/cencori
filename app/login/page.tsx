import { Suspense } from "react";
import { LoginForm } from "@/components/login-form"
import { Logo } from "@/components/logo"
import Link from "next/link"

function LoginPageContent() {
  return (
    <div className="min-h-svh flex items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="flex justify-center">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <Logo variant="wordmark" className="h-6" />
          </Link>
        </div>
        <div className="w-full">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-svh flex items-center justify-center">Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  )
}
