import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");

export function loadEnv() {
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function readEnv(name, fallback = "") {
  return process.env[name] || fallback;
}

/** Set CENCORI_AGENT_ID only when a real dashboard agent UUID is configured. */
export function readOptionalAgentId() {
  const raw = (process.env.CENCORI_AGENT_ID || "").trim();
  const placeholders = new Set([
    "",
    "demo-agent",
    "your_agent_id",
    "agent_uuid_or_blank_for_project_key",
  ]);
  if (placeholders.has(raw)) return null;
  return raw;
}
