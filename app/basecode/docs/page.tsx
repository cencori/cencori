import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/nav/SiteNav";

export const metadata: Metadata = {
  title: "Basecode documentation | Cencori",
  description: "Set up Basecode, choose coding models, import another agent’s configuration, and manage import syncing.",
  alternates: { canonical: "https://cencori.com/basecode/docs" },
};

const sections = [
  ["get-started", "Get started"],
  ["agents-and-imports", "Agents & imports"],
  ["import-setup", "Import a setup"],
  ["syncing", "Keep imports in sync"],
  ["models", "Choose models"],
  ["troubleshooting", "Troubleshooting"],
] as const;

export default function BasecodeDocsPage() {
  return (
    <div className="marketing-theme min-h-screen bg-background text-foreground">
      <SiteNav solid />
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-28 md:px-8">
        <Link href="/basecode" className="text-sm text-muted-foreground hover:text-foreground">← Basecode</Link>
        <header className="mb-12 mt-6 max-w-3xl">
          <p className="mb-3 text-sm font-medium text-muted-foreground">Documentation</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Make Basecode your workspace.</h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">Get set up, choose your coding models, and bring supported configuration from other agents into Basecode.</p>
        </header>
        <div className="grid gap-12 lg:grid-cols-[200px_minmax(0,1fr)]">
          <nav aria-label="On this page" className="h-fit border-b pb-6 lg:sticky lg:top-24 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
            <p className="mb-4 text-sm font-medium">On this page</p>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {sections.map(([id, title]) => <li key={id}><a href={`#${id}`} className="hover:text-foreground">{title}</a></li>)}
            </ul>
          </nav>
          <article className="min-w-0 max-w-3xl space-y-12 text-sm leading-7 text-muted-foreground [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-medium [&_h3]:text-foreground [&_p]:mb-4 [&_strong]:font-medium [&_strong]:text-foreground [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-3 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_section]:scroll-mt-24">
            <section id="get-started" aria-labelledby="get-started-title">
              <h2 id="get-started-title">Get started</h2>
              <ol>
                <li>Get Basecode from the <Link className="underline underline-offset-4" href="/basecode#download">download section</Link> and open the desktop app.</li>
                <li>Sign in with your Cencori account. When the browser prompts you to return to Basecode, continue into the app.</li>
                <li>Choose a project folder, or start a new task by describing what you want to build.</li>
                <li>Choose a model in the composer, send your request, and follow the task’s progress. Review file changes in the review panel and respond to any approval requests.</li>
              </ol>
              <p className="mt-4">You can start without importing another agent’s setup. Imports are an optional way to carry familiar instructions and configuration into your workspace.</p>
            </section>
            <section id="agents-and-imports" aria-labelledby="agents-title">
              <h2 id="agents-title">Agents &amp; imports</h2>
              <p>Open <strong>Settings → Agents &amp; imports</strong> to find supported setups on this device and choose what to bring over. The page separates detection, importing, and connecting because they do different things.</p>
              <ul>
                <li><strong>Detected on this device:</strong> Basecode found configuration it can import. Detection alone does not copy anything or connect an account.</li>
                <li><strong>Other agents:</strong> supported import sources with no setup found, alongside agents whose integrations are not available yet.</li>
                <li><strong>Import:</strong> copies selected supported items into Basecode. It does not transfer a subscription or use another agent to execute tasks.</li>
                <li><strong>Connect:</strong> is reserved for running tasks through an external agent. These connections are not implemented in the current app, so Connect buttons are disabled.</li>
              </ul>
              <h3>Current support</h3>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Available agent integrations in Basecode</caption>
                  <thead className="bg-muted/40 text-foreground"><tr><th scope="col" className="px-4 py-3">Agent</th><th scope="col" className="px-4 py-3">Import setup</th><th scope="col" className="px-4 py-3">Run through subscription</th></tr></thead>
                  <tbody>{["Claude Code", "Cursor", "Codex", "OpenCode", "GitHub Copilot", "Orca"].map((name) => <tr key={name} className="border-t"><th scope="row" className="px-4 py-3 font-medium text-foreground">{name}</th><td className="px-4 py-3">{name === "Claude Code" || name === "Cursor" ? "Supported when detected" : "Not available yet"}</td><td className="px-4 py-3">Not available yet</td></tr>)}</tbody>
                </table>
              </div>
              <p className="mt-4">An existing subscription is not an API key. There is currently no subscription connection to configure on this page; importing a setup does not enable one.</p>
            </section>
            <section id="import-setup" aria-labelledby="import-title">
              <h2 id="import-title">Import a setup</h2>
              <ol>
                <li>Set up Claude Code or Cursor on the same computer. Add the project folder to Basecode if you want it included when looking for project-specific configuration.</li>
                <li>Open <strong>Settings → Agents &amp; imports</strong>. Basecode checks supported sources on the first visit and remembers the result. Use <strong>Check again</strong> after changing your setup or adding a project.</li>
                <li>Choose <strong>Import</strong> on a detected agent’s card. The dialog shows the items actually found, with descriptions and counts where available.</li>
                <li>Select the items you want, then confirm with <strong>Import to Basecode</strong>. Configuration items start selected; past conversations start unselected.</li>
                <li>Check <strong>Import history</strong> for the outcome. If a part fails, review <strong>Needs attention</strong> and retry that item.</li>
              </ol>
              <h3>What can come across?</h3>
              <p>Depending on the source and what is detected, the dialog can include instructions, settings, skills, plugins, MCP server configuration, subagents, hooks, commands, memory, and past conversations. Not every source supplies every kind; the dialog is the authoritative list for your device.</p>
              <p>Past conversations copy what was said into Basecode and require an explicit selection. Importing configuration does not guarantee that an external service is ready to use: a service may still need its own credentials or setup.</p>
            </section>
            <section id="syncing" aria-labelledby="sync-title">
              <h2 id="sync-title">Keep imports in sync</h2>
              <p>The <strong>Import syncing</strong> section sits below the agent cards. After a successful import, enable <strong>Keep imports in sync</strong> to refresh previously imported configuration when you visit this settings page.</p>
              <ul>
                <li>Only kinds of configuration already imported successfully are eligible, and they must still be detected.</li>
                <li>Sync does not automatically opt you into new categories of data.</li>
                <li>Past conversations are excluded from automatic syncing, even if you imported them manually.</li>
                <li>This is a device preference. It is not continuous background monitoring or cloud synchronization.</li>
              </ul>
              <p className="mt-4">Use <strong>Check again</strong> to refresh detection. Turning syncing off stops future automatic imports; it does not undo earlier imports. Turning it back on allows another sync during the current visit.</p>
            </section>
            <section id="models" aria-labelledby="models-title">
              <h2 id="models-title">Choose models and providers</h2>
              <p>Open <strong>Settings → Models</strong> to browse Cencori’s coding model catalog. Maximo Atlas and GLM are enabled by default. Toggle additional available models on to show them in the composer, then select one there for your task.</p>
              <p>Enabled models appear below the defaults in settings, followed by curated coding recommendations. Search filters the list; the refresh icon reloads the catalog. Choices are saved for your account on this device. Auto remains a fallback when no model is enabled.</p>
              <p>Model availability depends on your plan. A disabled model with a frontier-plan note requires a plan that permits it. A Free badge identifies an offered free model; open weights alone do not imply free hosted usage.</p>
              <p><strong>Settings → Providers</strong> is the separate place for supported API-key connections. Adding an API key is different from importing agent configuration or connecting a coding subscription.</p>
            </section>
            <section id="troubleshooting" aria-labelledby="troubleshooting-title">
              <h2 id="troubleshooting-title">Troubleshooting</h2>
              <h3>My agent is installed but not detected</h3>
              <p>Detection looks for importable configuration, not simply an installed application. Confirm that you have used and configured a supported source on this computer, include the relevant project in Basecode, and select Check again. Codex, OpenCode, Copilot, and Orca do not currently have import adapters.</p>
              <h3>The Import button is disabled</h3>
              <p>Wait for detection or the current import to finish. If no supported items are found, there is nothing to import. For unsupported agents, the disabled button indicates that the integration is not available yet.</p>
              <h3>Part of an import failed</h3>
              <p>Read the item’s error under Needs attention. Resolve the reported issue, such as an unavailable source, and use Retry for that item. Import history shows successful and failed outcomes separately.</p>
              <h3>Sync did not copy a new conversation</h3>
              <p>This is expected. Open Import again and explicitly select Past conversations. Automatic syncing only refreshes previously imported, eligible configuration.</p>
              <h3>A model is missing or the catalog is unavailable</h3>
              <p>Use the refresh button in Settings → Models and check your connection. The default models remain listed if the catalog cannot be loaded. Check both the model toggle and your plan if a catalog entry is not available in the composer.</p>
            </section>
          </article>
        </div>
      </main>
    </div>
  );
}
