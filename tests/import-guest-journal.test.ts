import { beforeEach, expect, it, vi } from "vitest";
const api=vi.hoisted(()=>Object.fromEntries(["loadVisits","loadAppState","createVisit","addWishlistCity","saveWishlistOrder","createPersonalList","savePersonalListCities","saveRankingOrder","saveYearlyGoal"].map(name=>[name,vi.fn()])));
vi.mock("../src/backend",()=>api);
import { transferGuestJournal } from "../src/frontend/importGuestJournal";
let visits: any[], state: any;
const guest=JSON.stringify({cities:[{id:"one",name:"First",country:"Test",lat:1,lng:2},{id:"two",name:"Second",country:"Test",lat:2,lng:2}],lists:[{id:"list",title:"Guest list",cityIds:["one","two"]}],wishlist:[],manualOrder:["two","one"],yearlyGoal:12});
beforeEach(()=>{
  vi.resetAllMocks(); visits=[];state={wishlist:[],lists:[],rankingOrder:[],yearlyGoal:10};
  api.loadVisits.mockImplementation(async()=>structuredClone(visits));
  api.loadAppState.mockImplementation(async()=>structuredClone(state));
  api.createVisit.mockImplementation(async(city,id)=>{const saved={...city,id};visits.push(saved);return saved;});
  api.createPersonalList.mockImplementation(async(title,position,id)=>{const list={id,title,cityIds:[]};state.lists.push(list);return structuredClone(list);});
  api.savePersonalListCities.mockImplementation(async(id,ids)=>{state.lists.find((list:any)=>list.id===id).cityIds=ids;});
  api.saveRankingOrder.mockImplementation(async(order)=>{state.rankingOrder=order;});
  api.saveYearlyGoal.mockImplementation(async(goal)=>{state.yearlyGoal=goal;});
});
it("resumes an interrupted import, preserving cloud edits and relationships on repeated retries",async()=>{
  const save=api.createVisit.getMockImplementation()!;
  api.createVisit.mockImplementationOnce(save).mockRejectedValueOnce(new Error("offline"));
  await expect(transferGuestJournal(guest,"alice",()=>true)).rejects.toThrow("offline");
  expect(visits).toHaveLength(1);visits[0].note="Edited in cloud";
  await transferGuestJournal(guest,"alice",()=>true);
  state.lists[0].title="Edited cloud title";
  await transferGuestJournal(guest,"alice",()=>true);
  expect(visits).toHaveLength(2);
  expect(visits[0].note).toBe("Edited in cloud");
  expect(state.lists[0].title).toBe("Edited cloud title");
  expect(new Set(state.lists[0].cityIds).size).toBe(2);
  expect(state.rankingOrder).toEqual([visits[1].id,visits[0].id]);
});
it("stops after an account change without proceeding to the next record or list",async()=>{
  let current=true;
  api.createVisit.mockImplementationOnce(async(city,id)=>{visits.push({...city,id});current=false;});
  await expect(transferGuestJournal(guest,"alice",()=>current)).rejects.toThrow("Account changed");
  expect(api.createVisit).toHaveBeenCalledTimes(1);
  expect(api.createPersonalList).not.toHaveBeenCalled();
});
it("merges membership from a creation conflict discovered after the initial account read",async()=>{
  visits.push({id:"cloud-visit",name:"Cloud city"});
  api.createPersonalList.mockImplementationOnce(async(_title,_position,id)=>{
    const cloudList={id,title:"Title edited on another device",cityIds:["cloud-visit"]};
    state.lists.push(cloudList);
    return structuredClone(cloudList);
  });
  await transferGuestJournal(guest,"alice",()=>true);
  expect(state.lists[0].title).toBe("Title edited on another device");
  expect(state.lists[0].cityIds).toEqual(["cloud-visit",visits[1].id,visits[2].id]);
});
