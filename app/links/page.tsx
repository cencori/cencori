import Image from "next/image";
import { featured, links, socialLinks } from "./links";
import { ShareButton } from "./ShareButton";

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

export default function LinksPage() {
  return (
    <div className="dark relative min-h-dvh overflow-hidden bg-black font-[family-name:var(--font-manrope)] text-white">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ShareButton />
      </div>

      <main className="relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-5 pb-10 pt-16">
        <header className="flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-[22px]">
            <Image src="/logos/icon-white.svg" alt="Cencori" width={40} height={40} priority />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Cencori</h1>
          <p className="mt-2 max-w-[300px] text-sm leading-relaxed text-white/55">
            The computing infrastructure AI runs on.
          </p>

          <nav aria-label="Social" className="mt-5 flex items-center gap-1">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/50 transition hover:bg-white/[0.06] hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
                  <path d={social.path} />
                </svg>
              </a>
            ))}
          </nav>
        </header>

        <a
          href={featured.href}
          className="group relative mt-8 block overflow-hidden rounded-2xl"
        >
          <div className="relative aspect-[16/9]">
            <Image
              src={featured.image}
              alt=""
              fill
              sizes="440px"
              className="object-cover transition duration-500 group-hover:scale-[1.03]"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
            <div>
              <span className="mb-1.5 inline-block rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black">
                {featured.eyebrow}
              </span>
              <div className="text-lg font-semibold">{featured.label}</div>
              <div className="text-sm text-white/65">{featured.description}</div>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black transition group-hover:rotate-45">
              <Arrow />
            </span>
          </div>
        </a>

        <ul className="mt-3 flex flex-col gap-2.5">
          {links.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                className="group flex items-center justify-between gap-4 rounded-2xl bg-white/[0.06] px-5 py-4 transition hover:bg-white/[0.1]"
              >
                <div className="min-w-0">
                  <div className="text-[15px] font-medium">{link.label}</div>
                  <div className="truncate text-[13px] text-white/45">{link.description}</div>
                </div>
                <span className="text-white/35 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white">
                  <Arrow />
                </span>
              </a>
            </li>
          ))}
        </ul>

        <footer className="mt-auto pt-12 text-center text-xs text-white/30">
          © {new Date().getFullYear()} Cencori · cencori.com
        </footer>
      </main>
    </div>
  );
}
