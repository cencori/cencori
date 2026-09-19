import { describe, expect, it, vi } from "vitest";
import {
    abortOnNavigationIntent,
    announceNavigationIntent,
    isAbortError,
    onNavigationIntent,
} from "./navigation-intent";

describe("navigation intent", () => {
    it("notifies active page work before navigation", () => {
        const listener = vi.fn();
        const unsubscribe = onNavigationIntent(listener);

        announceNavigationIntent("/monetization");

        expect(listener).toHaveBeenCalledWith({ href: "/monetization" });
        unsubscribe();
    });

    it("aborts in-flight work and can unsubscribe cleanly", () => {
        const controller = new AbortController();
        const stopListening = abortOnNavigationIntent(controller);

        announceNavigationIntent("/monetization");

        expect(controller.signal.aborted).toBe(true);
        stopListening();
    });

    it("recognizes aborted requests without hiding other failures", () => {
        expect(isAbortError(new DOMException("Aborted", "AbortError"))).toBe(true);
        expect(isAbortError(new Error("Network failed"))).toBe(false);
    });
});
