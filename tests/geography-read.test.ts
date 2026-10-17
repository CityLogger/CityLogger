import { expect, it, vi } from "vitest";
import { geographicRead } from "../src/backend/geography";
it("reads old schemas without guessing missing geographic IDs", async () => {
  const query=vi.fn().mockResolvedValueOnce({data:null,error:{code:"42703",message:"geoname_id missing"}}).mockResolvedValueOnce({data:[{id:"old"}],error:null});
  expect(await geographicRead(query)).toEqual({data:[{id:"old"}],error:null});
  expect(query.mock.calls).toEqual([[true],[false]]);
});
it("does not turn authorization failures into a fallback or an empty success", async () => {
  const query=vi.fn().mockResolvedValue({data:null,error:{code:"42501",message:"denied"}});
  expect((await geographicRead(query)).error).toMatchObject({code:"42501"});
  expect(query).toHaveBeenCalledTimes(1);
});
