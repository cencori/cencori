import Link from "next/link";

export default function DocsHome() {
  return (
    <article className="prose prose-invert prose-zinc max-w-none">
      <h1>Jett Documentation</h1>
      <p className="text-lg text-muted">
        Build agents faster than the speed of light.
      </p>
      <hr />
      <h2>Getting Started</h2>
      <p>
        Create a new project, define your first agent, and run it locally — all
        in under a minute.
      </p>
      <pre className="rounded-xl border border-border bg-card p-4 text-sm overflow-x-auto">
        <code>{`npm create jett my-agent
cd my-agent
npm run dev`}</code>
      </pre>
      <Link
        href="/docs/getting-started"
        className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 bg-zinc-100 text-surface font-medium text-sm hover:bg-zinc-200 transition-all mt-4 no-underline"
      >
        Read Getting Started →
      </Link>
      <h2>Project Layout</h2>
      <p>
        Agents in Jett are defined as files in your project. Each directory is a
        slot with a specific purpose.
      </p>
      <Link
        href="/docs/project-layout"
        className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 border border-border text-sm font-medium text-muted hover:text-zinc-100 hover:border-zinc-600 transition-all mt-2 no-underline"
      >
        Learn about the layout →
      </Link>
      <h2>Why Jett?</h2>
      <ul>
        <li>
          <strong>Filesystem-first</strong> — no SDK boilerplate, no DSL, no
          hidden state
        </li>
        <li>
          <strong>Built on Cencori</strong> — model routing, billing, security
          handled out of the box
        </li>
        <li>
          <strong>Open source</strong> — MIT License, community-driven
        </li>
        <li>
          <strong>Instant deploy</strong> — compile to a manifest and ship
        </li>
      </ul>
    </article>
  );
}
