import { describe, expect, it } from "vitest";
import { isValidTimezone } from "@/lib/timezone";

describe("isValidTimezone", () => {
  it("accepts valid IANA timezones", () => {
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("America/Barbados")).toBe(true);
    expect(isValidTimezone("Europe/London")).toBe(true);
  });

  it("rejects empty or malformed values", () => {
    expect(isValidTimezone("")).toBe(false);
    expect(isValidTimezone("Not/AZone")).toBe(false);
    expect(isValidTimezone("garbage")).toBe(false);
  });
});
