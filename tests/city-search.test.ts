import { readFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";
import { createCitySearch, matchCityEntries } from "../src/frontend/citySearch";
import { citySearchBucket, normalizeCitySearch } from "../src/shared/citySearchKey";

it("normalizes diacritics, spacing and punctuation consistently",()=>{
  expect(normalizeCitySearch(" São-Paulo ")).toBe("sao paulo");
  expect(citySearchBucket("München")).toBe(citySearchBucket("Munchen"));
});
it("ranks exact names before popular partial matches without merging homonyms",()=>{
  const result=matchCityEntries([["1","ne",999,["new york"],"united states"],["2","yo",10,["york"],"united kingdom"],["3","yo",5,["york"],"united states"]],"York");
  expect(result.map(item=>item[0])).toEqual(["2","3","1"]);
});
it("reuses public shards and retries failed fetches rather than caching failures",async()=>{
  const load=vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([["1","mu",100,["munich"],"germany"]]).mockResolvedValue([["München","Munchen","Germany","Europe",1,2,100,"DE","1"]]);
  const search=createCitySearch(load);
  await expect(search("munich")).rejects.toThrow();
  expect((await search("munich"))[0].geonameId).toBe("1");
  await search("munich");
  expect(load).toHaveBeenCalledTimes(3);
});
it("does not resolve stale search results or load city shards after cancellation",async()=>{
  const abort=new AbortController();abort.abort();
  const load=vi.fn().mockResolvedValue([["1","mu",100,["munich"],"germany"]]);
  expect(await createCitySearch(load)("munich",abort.signal)).toEqual([]);
  expect(load).not.toHaveBeenCalled();
});
it("finds real alternative names and word fragments across the original shard boundary",async()=>{
  const search=createCitySearch(async url=>JSON.parse(await readFile(new URL(`../public${url}`,import.meta.url),"utf8")));
  for(const [query,id] of [["Munich","2867714"],["Bombay","1275339"],["York City","5128581"],["Sao Paulo","3448439"],["東京","1850147"]]) {
    expect((await search(query)).some(city=>city.geonameId===id),query).toBe(true);
  }
});
