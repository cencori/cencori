// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { isBetterAuthEnabled } from "@/lib/auth/flags";
import { toSupabaseUser } from "@/lib/auth/to-supabase-user";

describe("toSupabaseUser", () => {
    it("keeps the fields call sites read from a Supabase user", () => {
        const user = toSupabaseUser({
            id: "11111111-1111-4111-8111-111111111111",
            email: "pat@example.com",
            name: "Pat",
            image: "https://img/p.png",
            emailVerified: true,
            createdAt: "2026-01-02T03:04:05.000Z",
            updatedAt: new Date("2026-02-02T00:00:00.000Z"),
        });
        expect(user.id).toBe("11111111-1111-4111-8111-111111111111");
        expect(user.email).toBe("pat@example.com");
        expect(user.user_metadata).toMatchObject({ full_name: "Pat", name: "Pat", avatar_url: "https://img/p.png" });
        expect(user.email_confirmed_at).toBe("2026-01-02T03:04:05.000Z");
        expect(user.created_at).toBe("2026-01-02T03:04:05.000Z");
    });

    it("leaves email_confirmed_at unset for unverified users", () => {
        const user = toSupabaseUser({
            id: "x", email: "x@example.com", name: "x", emailVerified: false,
            createdAt: new Date(), updatedAt: new Date(),
        });
        expect(user.email_confirmed_at).toBeUndefined();
        expect(user.user_metadata.avatar_url).toBeUndefined();
    });
});

describe("isBetterAuthEnabled", () => {
    const original = { ...process.env };
    afterEach(() => { process.env = { ...original }; });

    it("is off unless a switch is set", () => {
        delete process.env.NEXT_PUBLIC_BETTER_AUTH_ENABLED;
        delete process.env.BETTER_AUTH_ENABLED;
        expect(isBetterAuthEnabled()).toBe(false);
    });

    it("turns on with either switch on the server", () => {
        process.env.NEXT_PUBLIC_BETTER_AUTH_ENABLED = "true";
        expect(isBetterAuthEnabled()).toBe(true);
        delete process.env.NEXT_PUBLIC_BETTER_AUTH_ENABLED;
        process.env.BETTER_AUTH_ENABLED = "true";
        expect(isBetterAuthEnabled()).toBe(true);
    });
});
