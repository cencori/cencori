import Link from "next/link";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { getConsoleUrl } from "@/lib/auth-redirect";

export function DevelopersCTA() {
  return (
    <section className="relative px-4 pb-20 sm:pb-28">
      <div className="mx-auto max-w-6xl">
        <div className="relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-2xl bg-white/[0.06] px-6 py-16 text-center sm:min-h-[420px] sm:py-20">
          <div className="relative z-10 mx-auto max-w-xl">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Build Different.
            </h2>
            <div className="mt-8 flex flex-row items-center justify-center gap-3">
              <Button
                asChild
                className="group h-10 rounded-full pr-2 pl-5 text-sm font-semibold"
              >
                <Link href={getConsoleUrl("/signup")}>
                  Start building
                  <HugeiconsIcon
                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                    color="currentColor"
                    icon={ArrowRight01Icon}
                    size={14}
                    strokeWidth={1.9}
                  />
                </Link>
              </Button>
              <Button
                asChild
                className="h-10 rounded-full px-5 text-sm font-semibold"
                variant="outline"
              >
                <Link href="/docs">Read the docs</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
