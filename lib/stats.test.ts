import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateStreak,
  complianceRate,
  distinctLocalDays,
  toLocalDate,
} from "@/lib/stats";

describe("toLocalDate", () => {
  it("formats a UTC timestamp as a YYYY-MM-DD date in UTC", () => {
    expect(toLocalDate("2026-06-18T10:00:00Z", "UTC")).toBe("2026-06-18");
  });

  it("rolls back a day for a negative-offset timezone near midnight UTC", () => {
    // 02:00 UTC is the previous evening in Barbados (UTC-4).
    expect(toLocalDate("2026-06-18T02:00:00Z", "America/Barbados")).toBe(
      "2026-06-17"
    );
  });
});

describe("distinctLocalDays", () => {
  it("returns the unique local days for a set of timestamps", () => {
    const days = distinctLocalDays(
      [
        "2026-06-18T08:00:00Z",
        "2026-06-18T20:00:00Z", // same UTC day as above
        "2026-06-19T08:00:00Z",
      ],
      "UTC"
    );
    expect(days.sort()).toEqual(["2026-06-18", "2026-06-19"]);
  });

  it("returns an empty array for no timestamps", () => {
    expect(distinctLocalDays([], "UTC")).toEqual([]);
  });
});

describe("calculateStreak", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Fixed "now": noon UTC on 2026-06-18.
    vi.setSystemTime(new Date("2026-06-18T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 0 when there are no completed dates", () => {
    expect(calculateStreak([], "UTC")).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    expect(
      calculateStreak(["2026-06-16", "2026-06-17", "2026-06-18"], "UTC")
    ).toBe(3);
  });

  it("stays active when the most recent day is yesterday", () => {
    expect(calculateStreak(["2026-06-16", "2026-06-17"], "UTC")).toBe(2);
  });

  it("returns 0 when the streak does not reach today or yesterday", () => {
    expect(calculateStreak(["2026-06-10", "2026-06-11"], "UTC")).toBe(0);
  });

  it("breaks the streak at the first gap", () => {
    // 18th + 17th are consecutive; 15th is separated by a gap on the 16th.
    expect(
      calculateStreak(["2026-06-15", "2026-06-17", "2026-06-18"], "UTC")
    ).toBe(2);
  });

  it("ignores duplicate dates", () => {
    expect(
      calculateStreak(["2026-06-18", "2026-06-18", "2026-06-17"], "UTC")
    ).toBe(2);
  });
});

describe("complianceRate", () => {
  it("is distinct completed days over days in range", () => {
    expect(complianceRate(3, 6)).toBeCloseTo(0.5);
  });

  it("returns 0 for a non-positive range", () => {
    expect(complianceRate(5, 0)).toBe(0);
  });

  it("never exceeds 1 even when many sessions land on few days (I3 regression)", () => {
    // Five sessions across two distinct days within a two-day range.
    const days = distinctLocalDays(
      [
        "2026-06-18T08:00:00Z",
        "2026-06-18T12:00:00Z",
        "2026-06-18T18:00:00Z",
        "2026-06-19T08:00:00Z",
        "2026-06-19T20:00:00Z",
      ],
      "UTC"
    );
    expect(complianceRate(days.length, 2)).toBe(1);
    expect(complianceRate(days.length, 2)).toBeLessThanOrEqual(1);
  });
});
