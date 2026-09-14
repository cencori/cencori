import { ArrowUpRight03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import Link from "next/link";

export function SiteCTA() {
  return (
    <section className="bg-[#e9e8e2] px-5 pb-28 pt-0 text-[#080808] sm:px-9">
      <div className="relative mx-auto max-w-[80rem] overflow-hidden rounded-[0.9rem]">
        <Image
          alt=""
          fill
          sizes="(max-width: 80rem) 100vw, 80rem"
          src="/cta.PNG"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70"
        />

        <div className="relative z-10 flex min-h-[15rem] items-end justify-end p-6 sm:min-h-[32rem] sm:p-8">
          <Link
            href="/login"
            className="inline-flex min-h-[2.2rem] items-center gap-[0.35rem] rounded-full bg-[#f3f3ef] px-4 text-[0.92rem] tracking-[-0.005em] text-[#050505] transition-colors hover:bg-[#e4e4de]"
          >
            Get Started Free
            <HugeiconsIcon
              color="currentColor"
              icon={ArrowUpRight03Icon}
              size={14}
              strokeWidth={1.9}
            />
          </Link>
        </div>
      </div>
    </section>
  );
}
