// Client-safe (no node imports) fake-email heuristics.
// Mirrors the server gate in lib/tensor-email-gate.ts minus the MX lookup,
// so obvious fakes bounce instantly in the UI without a round-trip.

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamailblock.com", "sharklasers.com",
  "tempmail.com", "temp-mail.io", "10minutemail.com", "10minutemail.net",
  "yopmail.com", "yopmail.fr", "yopmail.net", "trashmail.com", "trashmail.net",
  "throwawaymail.com", "getnada.com", "tempinbox.com", "mohmal.com", "fakemail.net",
  "emailondeck.com", "maildrop.cc", "mailnesia.com", "mytemp.email", "tempail.com",
  "dispostable.com", "spambog.com", "spamgourmet.com", "mintemail.com", "e4ward.com",
  "mailcatch.com", "harakirimail.com", "wegwerfmail.de", "trash-mail.com",
]);

const RESERVED_DOMAINS = new Set([
  "example.com", "example.org", "example.net", "test.com", "test.org", "test.net",
  "invalid.com", "localhost",
]);

const FAKE_LOCALS = new Set([
  "test", "tester", "testing", "asdf", "asdfasdf", "qwerty", "fake", "fakemail",
  "dummy", "example", "sample", "xxx", "xxxx", "temp", "tempmail", "trash",
  "throwaway", "xyz", "abc", "abc123", "123", "12345", "none", "null", "nil",
  "noreply", "no-reply", "donotreply",
]);

export type QuickGate = "ok" | "disposable" | "fake";

export function quickGateEmail(raw: string): QuickGate {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return "fake";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  if (FAKE_LOCALS.has(local)) return "fake";
  if (/^(test|asdf|qwerty|x{3,}|fake|dummy|sample|temp|trash|abc)\d*$/.test(local)) return "fake";
  if (DISPOSABLE_DOMAINS.has(domain)) return "disposable";
  if (RESERVED_DOMAINS.has(domain) || domain === "localhost" || !domain.includes(".")) return "fake";
  return "ok";
}

export function gateReply(gate: QuickGate | "unreachable"): string {
  if (gate === "disposable") {
    return "Looks like a throwaway address — mind giving me a real inbox I can reach you at?";
  }
  return "Hmm, I can't reach that inbox — mind double-checking the address?";
}
