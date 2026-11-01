import { describe, expect, it } from "vitest";
import { cleanProfile, describeBusinessHours } from "@/lib/studio/business-profile";

const nine = [{ open: "09:00", close: "18:00" }];

describe("cleanProfile", () => {
    it("keeps known categories, three at most, and drops the rest", () => {
        expect(cleanProfile({ categories: ["Beauty, hair & salon", "Nonsense", "Beauty, hair & salon", "Fashion & clothing", "Education", "Grocery store"] }).categories)
            .toEqual(["Beauty, hair & salon", "Fashion & clothing", "Education"]);
    });
    it("keeps valid hours only for selected hours", () => {
        const profile = cleanProfile({ hours: { mode: "selected", days: [[], nine, [{ open: "18:00", close: "09:00" }], [{ open: "9:00", close: "12:00" }, { open: "13:00", close: "17:00" }]] } });
        expect(profile.hours.days[1]).toEqual(nine);
        expect(profile.hours.days[2]).toEqual([]);
        expect(profile.hours.days[3]).toEqual([{ open: "09:00", close: "12:00" }, { open: "13:00", close: "17:00" }]);
        expect(cleanProfile({ hours: { mode: "always", days: [nine] } }).hours.days[0]).toEqual([]);
    });
    it("fixes up the website and drops the address with no location", () => {
        const profile = cleanProfile({ website: "glowsalon.ng", address: "12 Admiralty Way", no_location: true });
        expect(profile.website).toBe("https://glowsalon.ng");
        expect(profile.address).toBeNull();
        expect(cleanProfile({ website: "not a site" }).website).toBeNull();
    });
});

describe("describeBusinessHours", () => {
    it("reads like people say it", () => {
        const days = [[], nine, nine, nine, nine, nine, [{ open: "10:00", close: "16:00" }]];
        expect(describeBusinessHours({ mode: "selected", days })).toBe("Monday to Friday 9am to 6pm; Saturday 10am to 4pm; closed Sunday");
        expect(describeBusinessHours({ mode: "always", days: [] })).toBe("Open 24 hours, every day");
        expect(describeBusinessHours({ mode: "appointments", days: [] })).toBe("By appointment only");
    });
});
