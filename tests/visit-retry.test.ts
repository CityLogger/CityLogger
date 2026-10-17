import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({from:vi.fn(),user:vi.fn()}));
vi.mock("../src/backend/client",()=>({getBackendClient:()=>({from:mocks.from}),requireCurrentUser:mocks.user}));
import { createVisit } from "../src/backend/visits";
const draft={name:"City",country:"Country",continent:"Europe",lat:1,lng:2,emoji:"",rating:4,ratings:{personal:4,culture:null,architecture:null,food:null,nature:null,nightlife:null},dateFrom:"",dateTo:"",visitType:"",note:"guest note"};
beforeEach(()=>{vi.resetAllMocks();mocks.user.mockResolvedValue({id:"alice"});});
it("a retried creation reads the existing entry rather than overwriting a later cloud edit", async()=>{
  const upsert=vi.fn();
  const row={id:"operation",city_name:"City",country:"Country",continent:"Europe",latitude:1,longitude:2,overall_rating:4,personal_rating:4,culture_rating:null,architecture_rating:null,food_rating:null,nature_rating:null,nightlife_rating:null,date_from:null,date_to:null,note:"newer cloud edit"};
  const builder={upsert,select:vi.fn(()=>builder),eq:vi.fn(()=>builder),maybeSingle:async()=>({data:null,error:null}),single:async()=>({data:row,error:null})};
  upsert.mockReturnValue(builder);mocks.from.mockReturnValue(builder);
  expect((await createVisit(draft,"operation","alice")).note).toBe("newer cloud edit");
  expect(upsert.mock.calls[0][1]).toEqual({onConflict:"id",ignoreDuplicates:true});
  expect(mocks.user).toHaveBeenCalledWith("alice");
});
it("a failed insert propagates the failure without claiming a saved visit",async()=>{
  const builder={upsert:vi.fn(()=>builder),select:vi.fn(()=>builder),maybeSingle:async()=>({data:null,error:{message:"offline"}})};
  mocks.from.mockReturnValue(builder);
  await expect(createVisit(draft,"operation","alice")).rejects.toThrow("offline");
});
