import { promises as dns } from "node:dns";
import { gateReply, quickGateEmail } from "./tensor-email-quick";

export type { QuickGate as EmailGate } from "./tensor-email-quick";
export { gateReply } from "./tensor-email-quick";

const MX_TIMEOUT_MS = 4_000;

/**
 * Silent fake-email gate. No email is sent — this just refuses to accept
 * addresses that can't be real: bad patterns, temp-mail domains, reserved
 * domains, or domains with no MX records (asdf@asdf.com).
 * DNS timeouts fail OPEN so a blip never blocks a legit signup.
 */
export async function gateEmail(raw: string): Promise<"ok" | "disposable" | "unreachable" | "fake"> {
  const quick = quickGateEmail(raw);
  if (quick !== "ok") return quick;

  const domain = raw.trim().toLowerCase().slice(raw.trim().toLowerCase().lastIndexOf("@") + 1);
  try {
    const mx = await Promise.race([
      dns.resolveMx(domain),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("mx-timeout")), MX_TIMEOUT_MS)),
    ]);
    if (!mx || mx.length === 0) return "unreachable";
  } catch {
    // Fail open on DNS errors/timeouts — only hard absence rejects.
    try {
      await dns.resolve(domain);
    } catch {
      return "unreachable";
    }
  }
  return "ok";
}
