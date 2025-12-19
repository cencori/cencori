import { SignupForm } from "@/components/signup-form";
import { Logo } from "@/components/logo";
import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <Logo variant="full" className="h-6" />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <SignupForm />
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <img
          src="/img.jpg"
          alt="FohnAI Image"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[1]"
        />
      </div>
    </div>
  );
}
