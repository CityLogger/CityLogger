import { getBackendClient, requireCurrentUser } from "./client";
import { BackendError, normaliseBackendError } from "./errors";
import { fetchAllPages } from "./pagination";
import { geographicRead } from "./geography";
import { fromLocationRow, toLocationRow, validateLocation, type LocationRow, type StoredLocation } from "./model";

export type StoredWishlistCity = StoredLocation & { id: string };

export type StoredPersonalList = {
  id: string;
  title: string;
  cityIds: string[];
};

type WishlistRow = LocationRow & { id: string };

type ListRow = { id: string; title: string };
type ListCityRow = { list_id: string; visit_id: string };

export type StoredAppState = {
  displayName: string;
  yearlyGoal: number;
  rankingOrder: string[];
  wishlist: StoredWishlistCity[];
  lists: StoredPersonalList[];
};

export async function loadAppState(expectedUserId?: string): Promise<StoredAppState> {
  const client = getBackendClient();
  const user = await requireCurrentUser(expectedUserId);
  const [profileResult, wishlistRows, listRows, listCities] = await Promise.all([
    client.from("profiles").select("display_name, yearly_goal, ranking_order, wishlist_order").eq("id", user.id).single(),
    fetchAllPages<WishlistRow>((from, to) => geographicRead(includeId => client.from("wishlist_cities").select("id, city_name, country, continent, latitude, longitude, emoji" + (includeId ? ", geoname_id" : "")).eq("user_id", user.id).order("created_at").order("id").range(from, to)), "Could not load Want to Visit cities."),
    fetchAllPages<ListRow>((from, to) => client.from("personal_lists").select("id, title").order("position").eq("user_id", user.id).order("created_at").order("id").range(from, to), "Could not load your lists."),
    fetchAllPages<ListCityRow>((from, to) => client.from("personal_list_cities").select("list_id, visit_id").order("position").eq("user_id", user.id).order("created_at").order("id").range(from, to), "Could not load your list entries.")
  ]);
  if (profileResult.error) throw normaliseBackendError(profileResult.error, "Could not load your saved lists and preferences.");

  await requireCurrentUser(user.id);
  const cityIdsByList = new Map<string, string[]>();
  for (const item of listCities) {
    const cityIds = cityIdsByList.get(item.list_id) || [];
    cityIds.push(item.visit_id);
    cityIdsByList.set(item.list_id, cityIds);
  }
  const wishlistOrder = (profileResult.data?.wishlist_order || []) as string[];
  const wishlistPositions = new Map(wishlistOrder.map((id, index) => [id, index]));
  return {
    displayName: profileResult.data?.display_name || "",
    yearlyGoal: profileResult.data?.yearly_goal || 10,
    rankingOrder: profileResult.data?.ranking_order || [],
    wishlist: wishlistRows.map(row => ({
      id: row.id,
      ...fromLocationRow(row)
    })).sort((a, b) => (wishlistPositions.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (wishlistPositions.get(b.id) ?? Number.MAX_SAFE_INTEGER)),
    lists: listRows.map(list => ({
      id: list.id,
      title: list.title,
      cityIds: cityIdsByList.get(list.id) || []
    }))
  };
}

export async function saveYearlyGoal(yearlyGoal: number, expectedUserId?: string) {
  if (!Number.isInteger(yearlyGoal) || yearlyGoal < 1 || yearlyGoal > 999) throw new BackendError("VALIDATION", "Choose a yearly goal between 1 and 999.");
  const client = getBackendClient();
  const user = await requireCurrentUser(expectedUserId);
  const { error } = await client.from("profiles").upsert({ id: user.id, yearly_goal: yearlyGoal }, { onConflict: "id" });
  if (error) throw normaliseBackendError(error, "Could not save your yearly goal.");
}

export async function saveRankingOrder(rankingOrder: string[], expectedUserId?: string) {
  const client = getBackendClient();
  const user = await requireCurrentUser(expectedUserId);
  const { error } = await client.from("profiles").upsert({ id: user.id, ranking_order: rankingOrder }, { onConflict: "id" });
  if (error) throw normaliseBackendError(error, "Could not save your ranking order.");
}

export async function saveWishlistOrder(wishlistOrder: string[], expectedUserId?: string) {
  const client = getBackendClient();
  const user = await requireCurrentUser(expectedUserId);
  const { error } = await client.from("profiles").upsert({ id: user.id, wishlist_order: wishlistOrder }, { onConflict: "id" });
  if (error) throw normaliseBackendError(error, "Could not save your Want to Visit order.");
}

export async function addWishlistCity(city: Omit<StoredWishlistCity, "id">, expectedUserId?: string): Promise<StoredWishlistCity> {
  const validationError = validateLocation(city);
  if (validationError) throw new BackendError("VALIDATION", validationError);
  const client = getBackendClient();
  const user = await requireCurrentUser(expectedUserId);
  const { data, error } = await client.from("wishlist_cities").upsert({
    ...toLocationRow(city),
    user_id: user.id
  }, { onConflict: "user_id,city_name,country,latitude,longitude" }).select("id, city_name, country, continent, latitude, longitude, emoji").single();
  if (error) throw normaliseBackendError(error, "Could not save this city to Want to Visit.");
  const row = data as WishlistRow;
  return { id: row.id, ...fromLocationRow(row), ...(city.geonameId ? { geonameId: city.geonameId } : {}) };
}

export async function removeWishlistCity(city: Pick<StoredWishlistCity, "id" | "name" | "country">, expectedUserId?: string) {
  if (!city.id) throw new BackendError("VALIDATION", "Reload the saved city before removing it.");
  const client = getBackendClient();
  const user = await requireCurrentUser(expectedUserId);
  const { error } = await client.from("wishlist_cities").delete().eq("id", city.id).eq("user_id", user.id);
  if (error) throw normaliseBackendError(error, "Could not remove this city from Want to Visit.");
}

export async function createPersonalList(title: string, position: number, id = crypto.randomUUID(), expectedUserId?: string): Promise<StoredPersonalList> {
  const cleanTitle = title.trim();
  if (!cleanTitle || cleanTitle.length > 100) throw new BackendError("VALIDATION", "List titles must be between 1 and 100 characters.");
  const client = getBackendClient();
  const user = await requireCurrentUser(expectedUserId);
  const { data, error } = await client.from("personal_lists").upsert({ id, user_id: user.id, title: cleanTitle, position }, { onConflict: "id", ignoreDuplicates: true }).select("id, title").maybeSingle();
  if (error) throw normaliseBackendError(error, "Could not create this list.");
  if (!data) {
    // A retried creation must preserve later cloud edits and list membership.
    const existing = await client.from("personal_lists").select("id, title").eq("id", id).eq("user_id", user.id).single();
    if (existing.error) throw normaliseBackendError(existing.error, "Could not verify the saved list.");
    const entries = await fetchAllPages<ListCityRow>(
      (from, to) => client.from("personal_list_cities").select("list_id, visit_id").eq("list_id", id).eq("user_id", user.id).order("position").order("created_at").order("id").range(from, to),
      "Could not load your list entries."
    );
    return { id: existing.data.id, title: existing.data.title, cityIds: entries.map(entry => entry.visit_id) };
  }
  return { id: data.id, title: data.title, cityIds: [] };
}

export async function renamePersonalList(listId: string, title: string, expectedUserId?: string) {
  const cleanTitle = title.trim();
  if (!cleanTitle || cleanTitle.length > 100) throw new BackendError("VALIDATION", "List titles must be between 1 and 100 characters.");
  const client = getBackendClient();
  const user = await requireCurrentUser(expectedUserId);
  const { error } = await client.from("personal_lists").update({ title: cleanTitle }).eq("id", listId).eq("user_id", user.id);
  if (error) throw normaliseBackendError(error, "Could not rename this list.");
}

export async function deletePersonalList(listId: string, expectedUserId?: string) {
  const client = getBackendClient();
  const user = await requireCurrentUser(expectedUserId);
  const { error } = await client.from("personal_lists").delete().eq("id", listId).eq("user_id", user.id);
  if (error) throw normaliseBackendError(error, "Could not delete this list.");
}

export async function savePersonalListCities(listId: string, cityIds: string[], expectedUserId?: string) {
  const client = getBackendClient();
  await requireCurrentUser(expectedUserId);
  const { error } = await client.rpc("replace_personal_list_cities", { target_list_id: listId, ordered_visit_ids: cityIds });
  if (error) throw normaliseBackendError(error, "Could not update this list.");
}
