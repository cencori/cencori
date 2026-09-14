import Link from "next/link";

export function CapabilityStub({
  eyebrow,
  title,
  blurb,
  backHref,
  backLabel,
}: {
  eyebrow: string;
  title: string;
  blurb: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-6xl px-6 py-24 text-center sm:px-12 sm:py-32">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="mx-auto mt-4 max-w-2xl font-serif text-4xl font-normal leading-tight tracking-tight text-foreground sm:text-5xl">
          {title}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {blurb}
        </p>
        <p className="mx-auto mt-6 max-w-xl text-xs leading-relaxed text-muted-foreground">
          We are building this page. Check back soon.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={backHref}
            className="inline-flex h-10 items-center justify-center rounded-md bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            {backLabel}
          </Link>
          <Link
            href="/contact"
            className="inline-flex h-10 items-center justify-center rounded-md border border-foreground/20 px-5 text-sm font-medium text-foreground transition-colors hover:border-foreground/40 hover:bg-foreground/5"
          >
            Talk to us
          </Link>
        </div>
      </div>
    </section>
  );
}
