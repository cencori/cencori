import { afterEach, describe, expect, it, vi } from "vitest";

let signedIn: string | null = "Founder@Cencori.com";
vi.mock("@/lib/auth/get-auth-user", () => ({ getAuthUser: async () => ({ data: { user: signedIn ? { email: signedIn } : null } }) }));
vi.mock("@/lib/supabaseServer", () => ({ createServerClient: async () => ({}) }));

const { signupAllowed, signupAllowlist, signupConfigFor } = await import("@/lib/channels/whatsapp-signup");

afterEach(() => {
    delete process.env.META_SIGNUP_ALLOWLIST;
    signedIn = "Founder@Cencori.com";
});

describe("our own WhatsApp signup, by allow-list", () => {
    it("is open to no one until it's set", async () => {
        expect(signupAllowlist()).toEqual(new Set());
        expect(await signupAllowed()).toBe(false);
    });

    it("lets in the listed emails, whatever their case, and no one else", async () => {
        process.env.META_SIGNUP_ALLOWLIST = " founder@cencori.com , tester@example.com ";
        expect(await signupAllowed()).toBe(true);
        signedIn = "customer@restaurant.ng";
        expect(await signupAllowed()).toBe(false);
        signedIn = null;
        expect(await signupAllowed()).toBe(false);
    });

    it("opens to everyone with *, once Meta approves", async () => {
        process.env.META_SIGNUP_ALLOWLIST = "*";
        signedIn = "customer@restaurant.ng";
        expect(await signupAllowed()).toBe(true);
    });

    it("reports the signup settings only to those it's open to", async () => {
        process.env.META_APP_ID = "app";
        process.env.META_EMBEDDED_SIGNUP_CONFIG_ID = "config";
        process.env.META_APP_SECRET = "secret";
        expect(await signupConfigFor()).toBeNull();
        process.env.META_SIGNUP_ALLOWLIST = "founder@cencori.com";
        expect(await signupConfigFor()).toMatchObject({ app_id: "app", config_id: "config" });
    });
});
