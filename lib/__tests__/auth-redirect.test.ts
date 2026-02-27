import { describe, expect, test } from "vitest";
import { resolveAuthRedirectTargets } from "@/lib/auth-redirect";

describe("resolveAuthRedirectTargets", () => {
    test("resolves relative redirects against current origin", () => {
        const result = resolveAuthRedirectTargets("/scan", {
            currentOrigin: "https://scan.cencori.com",
        });

        expect(result.oauthRedirectTo).toBe("https://scan.cencori.com/scan");
        expect(result.navigationTarget).toBe("/scan");
    });

    test("supports allowed cross-subdomain absolute redirects", () => {
        const result = resolveAuthRedirectTargets("https://scan.cencori.com/import", {
            currentOrigin: "https://cencori.com",
        });

        expect(result.oauthRedirectTo).toBe("https://scan.cencori.com/import");
        expect(result.navigationTarget).toBe("https://scan.cencori.com/import");
    });

    test("blocks external redirects and falls back safely", () => {
        const result = resolveAuthRedirectTargets("https://evil.example.com/phish", {
            currentOrigin: "https://cencori.com",
            defaultPath: "/dashboard/organizations",
        });

        expect(result.oauthRedirectTo).toBe("https://cencori.com/dashboard/organizations");
        expect(result.navigationTarget).toBe("/dashboard/organizations");
    });

    test("defaults to dashboard when redirect is missing", () => {
        const result = resolveAuthRedirectTargets(null, {
            currentOrigin: "https://cencori.com",
        });

        expect(result.oauthRedirectTo).toBe("https://cencori.com/dashboard/organizations");
        expect(result.navigationTarget).toBe("/dashboard/organizations");
    });
});

