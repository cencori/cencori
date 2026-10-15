import { describe, expect, test } from "vitest";
import {
    resolveAuthRedirectTargets,
    getConsoleOrigin,
    getConsoleUrl,
    getPostLoginDefault,
    resolveConsoleBaseUrl,
    getOAuthCallbackBase,
    getOAuthDefaultNext,
    getConsoleAwareNavigationTarget,
    resolvePostAuthDestination,
    sanitizeAuthRedirectTarget,
} from "@/lib/auth-redirect";

describe("getConsoleUrl", () => {
    test("builds absolute dashboard-intent links on the console host", () => {
        expect(getConsoleUrl("/home", "https://console.cencori.com")).toBe("https://console.cencori.com/home");
        expect(getConsoleUrl("signup", "http://console.localhost:3000")).toBe("http://console.localhost:3000/signup");
    });
});

describe("resolveConsoleBaseUrl", () => {
    test("resolves request origins to their console counterpart", () => {
        expect(resolveConsoleBaseUrl("https://cencori.com")).toBe("https://console.cencori.com");
        expect(resolveConsoleBaseUrl("https://console.cencori.com/home")).toBe("https://console.cencori.com");
        expect(resolveConsoleBaseUrl("http://localhost:3000")).toBe("http://console.localhost:3000");
    });
});

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
            defaultPath: "/dashboard",
        });

        expect(result.oauthRedirectTo).toBe("https://cencori.com/dashboard");
        expect(result.navigationTarget).toBe("/dashboard");
    });

    test("defaults to dashboard when redirect is missing", () => {
        const result = resolveAuthRedirectTargets(null, {
            currentOrigin: "https://cencori.com",
        });

        expect(result.oauthRedirectTo).toBe("https://cencori.com/dashboard");
        expect(result.navigationTarget).toBe("/dashboard");
    });

    test("honors absolute default paths (console home on main hosts)", () => {
        // getPostLoginDefault() returns an absolute URL on main-app hosts.
        // Resolving it against the base origin used to yield garbage like
        // /https://console.cencori.com/home and strand the callback on
        // cencori.com.
        const result = resolveAuthRedirectTargets(null, {
            currentOrigin: "https://cencori.com",
            defaultPath: "https://console.cencori.com/home",
        });

        expect(result.navigationTarget).toBe("https://console.cencori.com/home");
    });
});

describe("getConsoleOrigin", () => {
    test("maps main hosts to their console origin", () => {
        expect(getConsoleOrigin("https://cencori.com")).toBe("https://console.cencori.com");
        expect(getConsoleOrigin("https://www.cencori.com/login")).toBe("https://console.cencori.com");
        expect(getConsoleOrigin("http://localhost:3000/login")).toBe("http://console.localhost:3000");
        expect(getConsoleOrigin("http://127.0.0.1:3000")).toBe("http://console.localhost:3000");
    });

    test("returns null for console and product hosts", () => {
        expect(getConsoleOrigin("https://console.cencori.com/home")).toBeNull();
        expect(getConsoleOrigin("http://console.localhost:3000/home")).toBeNull();
        expect(getConsoleOrigin("https://scan.cencori.com")).toBeNull();
        expect(getConsoleOrigin("not-a-url")).toBeNull();
    });
});

describe("getPostLoginDefault", () => {
    test("lands on console home", () => {
        expect(getPostLoginDefault("https://console.cencori.com/login")).toBe("/home");
        expect(getPostLoginDefault("http://console.localhost:3000/login")).toBe("/home");
        expect(getPostLoginDefault("https://cencori.com/login")).toBe("https://console.cencori.com/home");
        expect(getPostLoginDefault("http://localhost:3000/login")).toBe("http://console.localhost:3000/home");
    });

    test("falls back to dashboard elsewhere", () => {
        expect(getPostLoginDefault("https://scan.cencori.com/login")).toBe("/dashboard");
    });
});

describe("getOAuthCallbackBase", () => {
    test("runs the callback on the console host for main-app origins", () => {
        expect(getOAuthCallbackBase("https://cencori.com")).toBe("https://console.cencori.com");
        expect(getOAuthCallbackBase("https://console.cencori.com")).toBe("https://console.cencori.com");
        expect(getOAuthCallbackBase("http://localhost:3000")).toBe("http://console.localhost:3000");
    });

    test("preserves product subdomains with no console counterpart", () => {
        expect(getOAuthCallbackBase("https://scan.cencori.com")).toBe("https://scan.cencori.com");
    });
});

describe("getOAuthDefaultNext", () => {
    test("is always absolute on the console host so it survives a host switch", () => {
        expect(getOAuthDefaultNext("https://console.cencori.com")).toBe("https://console.cencori.com/home");
        expect(getOAuthDefaultNext("https://cencori.com")).toBe("https://console.cencori.com/home");
    });
});

describe("getConsoleAwareNavigationTarget", () => {
    test("bounces relative console paths on the main host to console", () => {
        expect(getConsoleAwareNavigationTarget("/home", "https://cencori.com")).toBe(
            "https://console.cencori.com/home",
        );
        expect(getConsoleAwareNavigationTarget("/agents", "https://cencori.com")).toBe(
            "https://console.cencori.com/agents",
        );
    });

    test("leaves console-host and marketing targets untouched", () => {
        expect(getConsoleAwareNavigationTarget("/home", "https://console.cencori.com")).toBe("/home");
        expect(getConsoleAwareNavigationTarget("/pricing", "https://cencori.com")).toBe("/pricing");
        expect(getConsoleAwareNavigationTarget("/dashboard", "https://cencori.com")).toBe("/dashboard");
    });
});

describe("sanitizeAuthRedirectTarget", () => {
    test("strips dead OAuth codes so a bounced return can't poison the retry", () => {
        expect(sanitizeAuthRedirectTarget("/home?code=376689d3-2c66-436d-a3eb-c27394054461&next=%2Fhome")).toBe(
            "/home",
        );
        expect(sanitizeAuthRedirectTarget("/home?token_hash=abc&type=magiclink")).toBe("/home");
    });

    test("preserves legit query (invite tokens, app params)", () => {
        expect(sanitizeAuthRedirectTarget("/invite?token=abc123")).toBe("/invite?token=abc123");
        expect(sanitizeAuthRedirectTarget("/tensor/sign-in?callback_url=https%3A%2F%2Fx")).toBe(
            "/tensor/sign-in?callback_url=https%3A%2F%2Fx",
        );
    });

    test("handles absolute targets and null", () => {
        expect(sanitizeAuthRedirectTarget("https://cencori.com/home?code=X")).toBe("https://cencori.com/home");
        expect(sanitizeAuthRedirectTarget(null)).toBeNull();
        expect(sanitizeAuthRedirectTarget("/home")).toBe("/home");
    });
});

describe("resolvePostAuthDestination", () => {
    test("recovers a poisoned redirect to the clean console home", () => {
        expect(
            resolvePostAuthDestination(
                "/home?code=376689d3-2c66-436d-a3eb-c27394054461&next=%2Fhome",
                "https://console.cencori.com",
            ),
        ).toBe("/home");
        expect(resolvePostAuthDestination(null, "https://cencori.com")).toBe("https://console.cencori.com/home");
    });
});
