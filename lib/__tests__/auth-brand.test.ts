import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const sent: Array<{ from: string; subject: string; html: string }> = [];
vi.mock("@sendbyte/node", () => ({
  SendByte: class {
    emails = { send: async (message: { from: string; subject: string; html: string }) => void sent.push(message) };
  },
}));

import { authBrandFor } from "@/lib/auth/brand";
import { withAuthBrand } from "@/lib/auth/brand-context";
import { sendPasswordResetEmail } from "@/lib/email/password-reset-email";
import { sendVerificationCodeEmail } from "@/lib/email/verification-code-email";

describe("Tensor's sign-in looks like Tensor", () => {
  beforeEach(() => {
    sent.length = 0;
    process.env.SENDBYTE_API_KEY = "test";
  });

  it("knows a Tensor sign-in by where it returns to", () => {
    expect(authBrandFor("/tensor/sign-in?code_challenge=x&state=y")).toBe("tensor");
    expect(authBrandFor("/dashboard")).toBe("cencori");
    expect(authBrandFor(null)).toBe("cencori");
    expect(authBrandFor(undefined)).toBe("cencori");
  });

  it("sends Tensor emails inside a Tensor request, and Cencori's otherwise", async () => {
    await withAuthBrand("tensor", () => sendVerificationCodeEmail({ code: "123456", to: "a@example.com" }));
    await withAuthBrand("tensor", () => sendPasswordResetEmail({ to: "a@example.com", url: "https://cencori.com/x" }));
    await sendVerificationCodeEmail({ code: "123456", to: "a@example.com" });
    await sendPasswordResetEmail({ to: "a@example.com", url: "https://cencori.com/x" });

    expect(sent.map((message) => [message.from, message.subject])).toEqual([
      ["Tensor <system@send.cencori.com>", "Your Tensor verification code"],
      ["Tensor <system@send.cencori.com>", "Reset your Tensor password"],
      ["Cencori <system@send.cencori.com>", "Your verification code"],
      ["Cencori <system@send.cencori.com>", "Reset your password"],
    ]);
    expect(sent[0].html).toContain("Tensor, secured by Cencori.");
    expect(sent[1].html).toContain("your Tensor account");
    expect(sent[2].html).toContain("Making AI infrastructure accessible");
  });
});
