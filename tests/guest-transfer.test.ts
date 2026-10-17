import { expect, it } from "vitest";
import { guestTransferId, verifyGuestTransfer } from "../src/frontend/guestTransfer";
it("uses stable retry IDs and isolates transfers to different accounts", async () => {
  expect(await guestTransferId("a","visit","legacy")).toBe(await guestTransferId("a","visit","legacy"));
  expect(await guestTransferId("a","visit","legacy")).not.toBe(await guestTransferId("b","visit","legacy"));
  expect(await guestTransferId("a","visit","legacy")).not.toBe(await guestTransferId("a","list","legacy"));
});
it("rejects partial transfer and permits verification after a retry", () => {
  const expected={visits:["v1","v2"],wishlist:["w"],ranking:["v2"],lists:[{id:"l",cityIds:["v2"]}]};
  const state={lists:[{id:"l",cityIds:["v2","existing"]}],wishlist:[{id:"w"}],rankingOrder:["v2"]};
  expect(()=>verifyGuestTransfer(expected,[{id:"v1"}],state)).toThrow("Guest entries remain");
  expect(()=>verifyGuestTransfer(expected,[{id:"v1"},{id:"v2"}],state)).not.toThrow();
  expect(()=>verifyGuestTransfer(expected,[{id:"v1"},{id:"v2"}],{...state,lists:[]})).toThrow();
});
