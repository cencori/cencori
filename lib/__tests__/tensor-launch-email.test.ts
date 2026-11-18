import { describe, expect, it } from "vitest";
import {
  tensorLaunchEmail,
  tensorWaitlistUnsubscribeToken,
  tensorWaitlistUnsubscribeUrl,
  waitlistFirstName,
} from "@/lib/email/tensor-launch";
import { verifyUserUnsubscribeToken } from "@/lib/user-unsubscribe";

const ID = "00000000-0000-0000-0000-000000000001";

describe("the Tensor launch email", () => {
  it("greets by first name, and without one when the waitlist has none", () => {
    expect(waitlistFirstName("  Ada Lovelace ")).toBe("Ada");
    expect(waitlistFirstName("")).toBeNull();
    expect(waitlistFirstName(null)).toBeNull();
    const named = tensorLaunchEmail({ firstName: "<Ada>", unsubscribeUrl: "https://example.com/u" });
    expect(named.subject).toBe("Tensor is live");
    expect(named.html).toContain("Hi &lt;Ada&gt;,");
    expect(tensorLaunchEmail({ firstName: null, unsubscribeUrl: "https://example.com/u" }).html).toContain("Hi there,");
  });

  it("signs an unsubscribe link that only its own waitlist entry accepts", () => {
    const token = tensorWaitlistUnsubscribeToken(ID);
    expect(verifyUserUnsubscribeToken(`tensor-waitlist:${ID}`, token)).toBe(true);
    // Not a token for an account with the same id, nor for another entry.
    expect(verifyUserUnsubscribeToken(ID, token)).toBe(false);
    expect(verifyUserUnsubscribeToken("tensor-waitlist:00000000-0000-0000-0000-000000000002", token)).toBe(false);
    const url = tensorWaitlistUnsubscribeUrl("https://cencori.com", ID);
    expect(url).toBe(`https://cencori.com/api/tensor/waitlist/unsubscribe?id=${ID}&token=${token}`);
    expect(tensorLaunchEmail({ firstName: null, unsubscribeUrl: url }).html).toContain(url.replace("&", "&"));
  });
});
