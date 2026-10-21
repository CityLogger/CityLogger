import { citySearchBucket, normalizeCitySearch } from "../shared/citySearchKey";
import type { CityOption } from "./types";

export type SearchEntry = [id: string, shard: string, population: number, aliases: string[], country: string];
type CityRecord = [string,string,string,string,number,number,number,string,string];
type LoadJson = (url: string) => Promise<unknown>;
const countryFlag = (code: string) => code.length === 2 ? String.fromCodePoint(...code.toUpperCase().split("").map(char => 127397 + char.charCodeAt(0))) : "🌍";

export function matchCityEntries(entries: SearchEntry[], query: string) {
  const needle=normalizeCitySearch(query), words=needle.split(" ");
  const scored=entries.flatMap(entry => {
    const scores=entry[3].filter(alias => words.every(word => `${alias} ${entry[4]}`.includes(word))).map(alias => alias===needle ? 0 : alias.startsWith(needle) ? 1 : 2);
    return scores.length ? [{entry,score:Math.min(...scores)}] : [];
  });
  return scored.sort((a,b)=>a.score-b.score || b.entry[2]-a.entry[2] || a.entry[0].localeCompare(b.entry[0])).slice(0,12).map(item=>item.entry);
}

export function createCitySearch(load: LoadJson = async url => {
  const response=await fetch(url);
  if(!response.ok) throw new Error("City search is temporarily unavailable. Please try again.");
  return response.json();
}) {
  const cache=new Map<string,Promise<unknown>>();
  function read(url:string) {
    const existing=cache.get(url);
    if(existing) { cache.delete(url); cache.set(url,existing); return existing; }
    const pending=load(url).catch(error=>{if(cache.get(url)===pending) cache.delete(url);throw error;});
    cache.set(url,pending);
    if(cache.size>24) cache.delete(cache.keys().next().value!);
    return pending;
  }
  return async (query:string, signal?:AbortSignal):Promise<CityOption[]> => {
    const needle=normalizeCitySearch(query);
    if(needle.length<2 || signal?.aborted) return [];
    const entries=await read(`/city-search/${citySearchBucket(needle)}.json`) as SearchEntry[];
    if(signal?.aborted) return [];
    const matches=matchCityEntries(entries,needle);
    const shards=await Promise.all([...new Set(matches.map(entry=>entry[1]))].map(async shard=>await read(`/cities/${shard}.json`) as CityRecord[]));
    if(signal?.aborted) return [];
    const records=new Map(shards.flat().map(record=>[record[8],record]));
    return matches.flatMap(([id])=>{
      const row=records.get(id);
      return row ? [{name:row[0],ascii:row[1],country:row[2],continent:row[3],lat:row[4],lng:row[5],population:row[6],emoji:countryFlag(row[7]),geonameId:row[8]}] : [];
    });
  };
}
export const searchCities=createCitySearch();
