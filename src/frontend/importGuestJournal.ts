import { addWishlistCity, createPersonalList, createVisit, loadAppState, loadVisits, savePersonalListCities, saveRankingOrder, saveWishlistOrder, saveYearlyGoal as saveStoredYearlyGoal, type StoredCity } from "../backend";
import type { City, CityOption, PersonalList, CityId } from "./types";
import { cityIdentity } from "./journey";
import { guestTransferId, verifyGuestTransfer } from "./guestTransfer";

/** Resumable import. This service never clears local storage; the caller verifies its snapshot. */
export async function transferGuestJournal(guestSnapshot: string | null, owner: string, isCurrent: () => boolean) {
  const check = () => { if (!isCurrent()) throw new Error("Account changed."); };
  check();
  const guest = JSON.parse(guestSnapshot || "null") as { cities: City[]; wishlist: CityOption[]; lists: PersonalList[]; manualOrder: CityId[] | null; yearlyGoal: number } | null;
  if (!guest) return null;
  const [existingVisits, existingState] = await Promise.all([loadVisits(owner), loadAppState(owner)]);
  check();
  const visitIds = new Set(existingVisits.map(visit => visit.id));
  const idMap = new Map<string, string>();
  // Save the goal first: a retry after partial visit insertion must not lose it.
  if (!existingVisits.length) await saveStoredYearlyGoal(guest.yearlyGoal || 10, owner);
  for (const visit of guest.cities || []) {
    check();
    const id = visitIds.has(String(visit.id)) ? String(visit.id) : await guestTransferId(owner, "visit", visit.id);
    idMap.set(String(visit.id), id);
    check();
    if (!visitIds.has(id)) { await createVisit(visit as StoredCity, id, owner); visitIds.add(id); }
  }
  const importedWishlist = [...existingState.wishlist];
  for (const city of guest.wishlist || []) {
    check();
    if (!importedWishlist.some(item => cityIdentity(item) === cityIdentity(city))) importedWishlist.push(await addWishlistCity(city, owner));
  }
  check();
  if (importedWishlist.length) await saveWishlistOrder(importedWishlist.map(city => city.id), owner);
  const transferredLists: {id: string; cityIds: string[]}[] = [];
  for (const [index, list] of (guest.lists || []).entries()) {
    check();
    const id = existingState.lists.some(item => item.id === String(list.id)) ? String(list.id) : await guestTransferId(owner, "list", list.id);
    check();
    // Creation can discover a list added after the initial read. Merge its
    // readback too, rather than treating a conflict-safe retry as an empty list.
    const existing = existingState.lists.find(item => item.id === id)
      || await createPersonalList(list.title, existingState.lists.length + index, id, owner);
    check();
    const cityIds = [...new Set([...existing.cityIds, ...list.cityIds.map(id => idMap.get(String(id))).filter((id): id is string => Boolean(id))])];
    await savePersonalListCities(id, cityIds, owner);
    transferredLists.push({id, cityIds});
  }
  check();
  const ranking = [...new Set([...existingState.rankingOrder, ...(guest.manualOrder || []).map(id => idMap.get(String(id))).filter((id): id is string => Boolean(id))])];
  if (ranking.length) await saveRankingOrder(ranking, owner);
  check();
  const result = await Promise.all([loadVisits(owner), loadAppState(owner)]);
  check();
  verifyGuestTransfer({visits:[...idMap.values()], lists:transferredLists, wishlist:importedWishlist.map(city => city.id), ranking}, result[0], result[1]);
  return result;
}
