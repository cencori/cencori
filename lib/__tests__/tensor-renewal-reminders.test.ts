import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { renewalReminderDue, renewalReminderText } from "@/lib/tensor-renewal-reminders";

const NOW = Date.parse("2026-11-10T12:00:00Z");
const inDays = (days: number) => new Date(NOW + days * 24 * 60 * 60 * 1000).toISOString();

describe("Tensor renewal reminders", () => {
  it("reminds three days before, the day before, and once the month has ended", () => {
    expect(renewalReminderDue(inDays(10), NOW)).toBeNull();
    expect(renewalReminderDue(inDays(2.5), NOW)).toBe("ends_3");
    expect(renewalReminderDue(inDays(0.5), NOW)).toBe("ends_1");
    expect(renewalReminderDue(inDays(-1), NOW)).toBe("ended");
  });

  it("stops reminding a month that ended days ago, and ignores an account with no end", () => {
    expect(renewalReminderDue(inDays(-3), NOW)).toBeNull();
    expect(renewalReminderDue(null, NOW)).toBeNull();
    expect(renewalReminderDue("not a date", NOW)).toBeNull();
  });

  it("says that renewing early keeps the days still left", () => {
    expect(renewalReminderText("ends_3", "Builder")).toEqual({
      title: "Your Tensor Builder plan ends in 3 days",
      body: "Pay for another month now and it is added to the end of this one, so you lose none of the days you have left.",
    });
  });
});
