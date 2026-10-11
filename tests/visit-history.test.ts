import { describe, expect, it } from "vitest";
import { cityIdentity, latestCities, visitHistory } from "../src/frontend/journey";

const first = { id:"first", name:"Lisbon", country:"Portugal", dateFrom:"2024-09-10", dateTo:"2024-09-13",rating:4.6,note:"First visit" };
const second = { ...first,id:"second",dateFrom:"2026-05-02",dateTo:"2026-05-05",rating:4.8,note:"Returned" };
const other = { ...first,id:"other",name:"Kyoto",country:"Japan" };

describe("city stories",()=>{
  it("keeps all visits while selecting the latest rating for the map",()=>{
    const visits=[first,other,second];
    expect(latestCities(visits)).toEqual([second,other]);
    expect(visitHistory(visits,first)).toEqual([second,first]);
    expect(visits).toEqual([first,other,second]);
  });
  it("does not merge cities with the same name in different countries",()=>{
    expect(latestCities([first,{...first,id:"elsewhere",country:"United States"}])).toHaveLength(2);
  });
  it("groups normalised names without losing historical entries",()=>{
    expect(cityIdentity(first)).toBe(cityIdentity({...first,name:" LISBON "}));
  });
  it("restores the prior city representation after the latest visit is removed",()=>{
    expect(latestCities([first,other]).find(city=>city.name==="Lisbon")?.rating).toBe(4.6);
  });
  it("an edit to a past visit does not overwrite the latest visit",()=>{
    const edited={...first,note:"A more detailed memory",rating:3};
    expect(latestCities([edited,second])).toEqual([second]);
    expect(visitHistory([edited,second],first)[1].note).toBe("A more detailed memory");
  });
  it("handles empty journals",()=>{
    expect(latestCities([])).toEqual([]);
    expect(visitHistory([],first)).toEqual([]);
  });
});
