import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { loadAgent } from "../loader.js";

export async function buildCommand(options: {
  agentDir: string;
  outDir: string;
}): Promise<void> {
  const agentDir = resolve(process.cwd(), options.agentDir);
  const outDir = resolve(process.cwd(), options.outDir);

  console.log(`\n  Building agent...\n`);

  if (!existsSync(agentDir)) {
    console.error(`  Agent directory not found: ${agentDir}`);
    process.exit(1);
  }

  try {
    const agent = await loadAgent(agentDir);

    mkdirSync(outDir, { recursive: true });

    const manifest = {
      config: agent.manifest.config,
      instructions: agent.manifest.instructions,
      tools: Object.keys(agent.manifest.tools),
      skills: Object.keys(agent.manifest.skills),
      hooks: Object.keys(agent.manifest.hooks),
      channels: Object.keys(agent.manifest.channels),
      schedules: Object.keys(agent.manifest.schedules),
      session: agent.manifest.session,
      policy: agent.manifest.policy,
    };

    writeFileSync(
      join(outDir, "manifest.json"),
      JSON.stringify(manifest, null, 2)
    );

    console.log(`  Written to ${outDir}/manifest.json`);
    console.log(`  Tools: ${manifest.tools.length}`);
    console.log(`  Skills: ${manifest.skills.length}`);
    console.log(`  Channels: ${manifest.channels.length}`);
    console.log(`  Schedules: ${manifest.schedules.length}`);
    console.log(`\n  Done.\n`);
  } catch (err) {
    console.error(`  Build failed:`, err);
    process.exit(1);
  }
}
