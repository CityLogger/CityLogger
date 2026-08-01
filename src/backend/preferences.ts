import { getBackendClient, requireCurrentUser } from "./client";
import { BackendError, normaliseBackendError } from "./errors";

export type StoredWishlistCity = {
  id: string;
  name: string;
  country: string;
  continent: string;
  lat: number;
  lng: number;
  emoji: string;
};

export type StoredPersonalList = {
  id: string;
  title: string;
  cityIds: string[];
};

type WishlistRow = {
  id: string;
  city_name: string;
  country: string;
  continent: string;
  latitude: number;
  longitude: number;
  emoji: string;
};

type ListRow = { id: string; title: string };
type ListCityRow = { list_id: string; visit_id: string };

export type StoredAppState = {
  displayName: string;
  yearlyGoal: number;
  rankingOrder: string[];
  wishlist: StoredWishlistCity[];
  lists: StoredPersonalList[];
};

export async function loadAppState(): Promise<StoredAppState> {
  const client = getBackendClient();
  await requireCurrentUser();
  const [profileResult, wishlistResult, listsResult, listCitiesResult] = await Promise.all([
    client.from("profiles").select("display_name, yearly_goal, ranking_order").single(),
    client.from("wishlist_cities").select("id, city_name, country, continent, latitude, longitude, emoji").order("created_at"),
    client.from("personal_lists").select("id, title").order("position").order("created_at"),
    client.from("personal_list_cities").select("list_id, visit_id").order("position").order("created_at")
  ]);
  const error = profileResult.error || wishlistResult.error || listsResult.error || listCitiesResult.error;
  if (error) throw normaliseBackendError(error, "Could not load your saved lists and preferences.");

  const listCities = (listCitiesResult.data || []) as ListCityRow[];
  return {
    displayName: profileResult.data?.display_name || "",
    yearlyGoal: profileResult.data?.yearly_goal || 10,
    rankingOrder: profileResult.data?.ranking_order || [],
    wishlist: ((wishlistResult.data || []) as WishlistRow[]).map(row => ({
      id: row.id,
      name: row.city_name,
      country: row.country,
      continent: row.continent,
      lat: row.latitude,
      lng: row.longitude,
      emoji: row.emoji
    })),
    lists: ((listsResult.data || []) as ListRow[]).map(list => ({
      id: list.id,
      title: list.title,
      cityIds: listCities.filter(item => item.list_id === list.id).map(item => item.visit_id)
    }))
  };
}

export async function saveYearlyGoal(yearlyGoal: number) {
  if (!Number.isInteger(yearlyGoal) || yearlyGoal < 1 || yearlyGoal > 999) throw new BackendError("VALIDATION", "Choose a yearly goal between 1 and 999.");
  const client = getBackendClient();
  const user = await requireCurrentUser();
  const { error } = await client.from("profiles").upsert({ id: user.id, yearly_goal: yearlyGoal }, { onConflict: "id" });
  if (error) throw normaliseBackendError(error, "Could not save your yearly goal.");
}

export async function saveRankingOrder(rankingOrder: string[]) {
  const client = getBackendClient();
  const user = await requireCurrentUser();
  const { error } = await client.from("profiles").upsert({ id: user.id, ranking_order: rankingOrder }, { onConflict: "id" });
  if (error) throw normaliseBackendError(error, "Could not save your ranking order.");
}

export async function addWishlistCity(city: Omit<StoredWishlistCity, "id">): Promise<StoredWishlistCity> {
  const client = getBackendClient();
  const user = await requireCurrentUser();
  const { data, error } = await client.from("wishlist_cities").upsert({
    user_id: user.id,
    city_name: city.name.trim(),
    country: city.country.trim(),
    continent: city.continent.trim(),
    latitude: city.lat,
    longitude: city.lng,
    emoji: city.emoji
  }, { onConflict: "user_id,city_name,country,latitude,longitude" }).select("id, city_name, country, continent, latitude, longitude, emoji").single();
  if (error) throw normaliseBackendError(error, "Could not save this city to Want to Visit.");
  const row = data as WishlistRow;
  return { id: row.id, name: row.city_name, country: row.country, continent: row.continent, lat: row.latitude, lng: row.longitude, emoji: row.emoji };
}

export async function removeWishlistCity(city: Pick<StoredWishlistCity, "id" | "name" | "country">) {
  const client = getBackendClient();
  await requireCurrentUser();
  let query = client.from("wishlist_cities").delete();
  query = city.id ? query.eq("id", city.id) : query.eq("city_name", city.name).eq("country", city.country);
  const { error } = await query;
  if (error) throw normaliseBackendError(error, "Could not remove this city from Want to Visit.");
}

export async function createPersonalList(title: string, position: number): Promise<StoredPersonalList> {
  const cleanTitle = title.trim();
  if (!cleanTitle || cleanTitle.length > 100) throw new BackendError("VALIDATION", "List titles must be between 1 and 100 characters.");
  const client = getBackendClient();
  const user = await requireCurrentUser();
  const { data, error } = await client.from("personal_lists").insert({ user_id: user.id, title: cleanTitle, position }).select("id, title").single();
  if (error) throw normaliseBackendError(error, "Could not create this list.");
  return { id: data.id, title: data.title, cityIds: [] };
}

export async function savePersonalListCities(listId: string, cityIds: string[]) {
  const client = getBackendClient();
  await requireCurrentUser();
  const { error } = await client.rpc("replace_personal_list_cities", { target_list_id: listId, ordered_visit_ids: cityIds });
  if (error) throw normaliseBackendError(error, "Could not update this list.");
}
