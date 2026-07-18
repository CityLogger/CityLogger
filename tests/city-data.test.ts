import { describe, expect, it } from "vitest";
import { calculateStoredOverall, validatePhoto } from "../lib/city-data";

describe("visit storage validation", () => {
  it("calculates the overall score from required and optional categories", () => {
    expect(calculateStoredOverall({
      personal: 5,
      culture: 4.5,
      architecture: 4,
      food: 4.5,
      nature: null,
      nightlife: null
    })).toBe(4.5);
  });

  it("accepts supported photographs under 10 MB", () => {
    expect(validatePhoto({ type: "image/jpeg", size: 2_000_000 })).toBeNull();
  });

  it("rejects unsupported or oversized photographs", () => {
    expect(validatePhoto({ type: "image/gif", size: 1000 })).toContain("JPEG");
    expect(validatePhoto({ type: "image/png", size: 11 * 1024 * 1024 })).toContain("10 MB");
  });
});
