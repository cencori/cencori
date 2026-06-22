import Link from "next/link";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <aside className="hidden md:flex w-64 flex-col gap-1 p-8 border-r border-border bg-card/50">
        <Link
          href="/"
          className="font-semibold tracking-tight text-base mb-6 hover:text-accent transition-colors"
        >
          ← Zett
        </Link>
        <span className="text-xs font-medium tracking-widest uppercase text-muted mb-2">
          Docs
        </span>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-sm text-muted hover:text-zinc-100 transition-colors py-1"
          >
            {l.label}
          </Link>
        ))}
      </aside>
      <main className="flex-1 p-8 md:p-12 max-w-3xl">{children}</main>
    </div>
  );
}

const links = [
  { href: "/docs", label: "Overview" },
  { href: "/docs/getting-started", label: "Getting Started" },
  { href: "/docs/project-layout", label: "Project Layout" },
];
