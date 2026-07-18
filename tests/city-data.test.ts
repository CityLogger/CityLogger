import { describe, expect, it } from "vitest";
import { calculateStoredOverall, validatePhoto, validateVisit } from "../src/backend";
import { fromVisitRow, toVisitRow } from "../src/backend/model";

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

  it("accepts calculated decimal overall scores while enforcing half-star categories", () => {
    const visit = {
      name: "Lisbon", country: "Portugal", continent: "Europe", lat: 38.72, lng: -9.14,
      emoji: "🇵🇹", rating: 4.7, dateFrom: "2026-01-01", dateTo: "2026-01-03",
      visitType: "Holiday", note: "Excellent",
      ratings: { personal: 5, culture: 4.5, architecture: 4.5, food: 5, nature: 4, nightlife: 5 }
    };
    expect(validateVisit(visit)).toBeNull();
    expect(validateVisit({ ...visit, ratings: { ...visit.ratings, food: 4.2 } })).toContain("half-star");
  });

  it("maps visits to and from explicit database fields without losing data", () => {
    const visit = {
      name: "Kyoto", country: "Japan", continent: "Asia", lat: 35.01, lng: 135.77,
      emoji: "🇯🇵", rating: 4.8, dateFrom: "2026-04-01", dateTo: "2026-04-08",
      visitType: "Holiday", note: "Gardens",
      ratings: { personal: 5, culture: 5, architecture: 5, food: 4.5, nature: 4, nightlife: null }
    };
    const row = toVisitRow(visit, "user-1", "visit-1");
    expect(fromVisitRow(row)).toEqual({ ...visit, id: "visit-1" });
  });
});
