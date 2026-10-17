import { describe, expect, it } from "vitest";
import { calculateStoredOverall, validateVisit } from "../src/backend";
import { fromVisitRow, toVisitRow } from "../src/backend/model";

describe("visit storage validation", () => {
  const minimalVisit = {
    name:"Lisbon",country:"Portugal",continent:"Europe",lat:38.72,lng:-9.14,emoji:"🇵🇹",
    rating:4.5,dateFrom:"",dateTo:"",visitType:"",note:"",
    ratings:{personal:4.5,culture:null,architecture:null,food:null,nature:null,nightlife:null}
  };
  it("saves personal-only ratings and omitted dates as null, not invented values", () => {
    expect(validateVisit(minimalVisit)).toBeNull();
    expect(calculateStoredOverall(minimalVisit.ratings)).toBe(4.5);
    const row=toVisitRow(minimalVisit,"user-1","visit-1");
    expect(row.date_from).toBeNull();
    expect(row.date_to).toBeNull();
    expect(row.food_rating).toBeNull();
    expect(fromVisitRow(row)).toEqual({...minimalVisit,id:"visit-1"});
  });
  it("accepts either date independently but rejects reversed or invalid dates", () => {
    expect(validateVisit({...minimalVisit,dateFrom:"2026-10-16"})).toBeNull();
    expect(validateVisit({...minimalVisit,dateTo:"2026-10-16"})).toBeNull();
    expect(validateVisit({...minimalVisit,dateFrom:"2026-10-16",dateTo:"2026-10-15"})).toContain("before");
    expect(validateVisit({...minimalVisit,dateFrom:"2026-02-30"})).toContain("valid visit date");
  });
  it("retains the creation time without treating it as a visit date", () => {
    const row={...toVisitRow(minimalVisit,"user-1","visit-1"),created_at:"2026-10-16T12:00:00Z"};
    expect(fromVisitRow(row).createdAt).toBe(row.created_at);
    expect(fromVisitRow(row).dateFrom).toBe("");
  });
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
