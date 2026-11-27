import Link from "next/link";

import { Logo } from "@/components/logo";
import type { AuthBrand } from "@/lib/auth/brand";

/** The mark at the top of an auth page: Tensor's for a Tensor sign-in, Cencori's otherwise. */
export function AuthMark({ brand, className = "h-6" }: { brand: AuthBrand; className?: string }) {
  if (brand === "tensor") {
    return (
      <a href="https://tensorade.app" aria-label="Tensor" className={`inline-flex items-center ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/tensor/baseb.png" alt="Tensor" className="block h-full w-auto dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/tensor/base.png" alt="Tensor" className="hidden h-full w-auto dark:block" />
      </a>
    );
  }
  return (
    <Link href="/" className="flex items-center gap-2 font-medium">
      <Logo variant="mark" className={className} />
    </Link>
  );
}

/** Under a Tensor sign-in: who runs it. */
export function SecuredByCencori({ className = "" }: { className?: string }) {
  return <p className={`text-xs text-muted-foreground ${className}`}>Secured by Cencori</p>;
}
