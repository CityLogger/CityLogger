import { describe, expect, it } from "vitest";
import { canonicalRanking, rankingIndex, reorderVisible } from "../src/frontend/rankingOrder";
import { cityIdentity, latestCities, visitHistory } from "../src/frontend/journey";
const city = (id: string, lat = 1, geonameId?: string) => ({id, name:"Springfield",country:"USA",lat,lng:2,geonameId,dateFrom:"",dateTo:"",rating:4});
describe("geographic identity", () => {
  it("keeps homonyms separate in legacy and identified records", () => {
    expect(latestCities([city("a",1),city("b",2)])).toHaveLength(2);
    expect(latestCities([city("a",1,"100"),city("b",1,"200")])).toHaveLength(2);
  });
  it("groups repeated identified visits even if display name changes", () => {
    const a=city("a",1,"100"), b={...a,id:"b",name:"New spelling"};
    expect(visitHistory([a,b],a)).toHaveLength(2);
    expect(cityIdentity(a)).not.toBe(cityIdentity(city("legacy")));
  });
  it("retains repeat-visit rank and integrates new cities", () => {
    const a=city("a"), again={...a,id:"again",dateFrom:"2026-10-17"}, b=city("b",2);
    expect(canonicalRanking([a,again,b],["a"])).toEqual(["a","b"]);
    expect(canonicalRanking([a,again,b],["a","again","missing"])).toEqual(["a","b"]);
  });
});
describe("filtered ranking persistence", () => {
  it("indexes repeated visits by their saved representative without merging homonyms", () => {
    const first=city("first",1,"100"), latest={...first,id:"latest",dateFrom:"2026-10-18"}, other=city("other",1,"200");
    const index=rankingIndex([first,latest,other],["missing","other","first","latest"]);
    expect(index.size).toBe(2);
    expect(index.get(cityIdentity(latest))).toEqual({id:"first",position:2});
    expect(index.get(cityIdentity(other))).toEqual({id:"other",position:1});
  });

  it("matches the previous history-based lookup on a large repeat-visit journal", () => {
    const visits=Array.from({length:600},(_,i)=>({...city(`visit-${i}`,i%200),dateFrom:`2026-10-${String(i%28+1).padStart(2,"0")}`}));
    const order=canonicalRanking(visits,visits.slice(0,200).map(visit=>visit.id).reverse());
    const index=rankingIndex(visits,order);
    const positions=new Map(order.map((id,position)=>[id,position]));
    for(const latest of latestCities(visits)) {
      const history=visitHistory(visits,latest);
      const expectedId=order.find(id=>history.some(visit=>visit.id===id));
      const expectedPosition=Math.min(...history.map(visit=>positions.get(visit.id)??Number.MAX_SAFE_INTEGER));
      expect(index.get(cityIdentity(latest))).toEqual({id:expectedId,position:expectedPosition});
    }
  });
  it("keeps hidden continent/category slots intact through repeated saves", () => {
    const full=["a","hidden","b","no-rating","c"];
    const saved=reorderVisible(full,["a","b","c"],"c","a");
    expect(saved).toEqual(["c","hidden","a","no-rating","b"]);
    const restored=JSON.parse(JSON.stringify(saved));
    expect(reorderVisible(restored,["c","a","b"],"a","c")).toEqual(["a","hidden","c","no-rating","b"]);
    expect(full).toEqual(["a","hidden","b","no-rating","c"]);
  });
  it("ignores stale drag identifiers", () => expect(reorderVisible([1,2],[1],9,1)).toEqual([1,2]));
  it("does not reset unrelated cities after a visit is deleted", () => {
    expect(canonicalRanking([city("b",2),city("c",3)],["c","deleted","b"])).toEqual(["c","b"]);
  });
});
