import { getBackendClient, requireCurrentUser } from "./client";
import { normaliseBackendError } from "./errors";
import { VISIT_COLUMNS } from "./model";

export async function downloadAccountData() {
  const client = getBackendClient();
  const user = await requireCurrentUser();
  const [profileResult, visitsResult, photosResult, wishlistResult, listsResult, listCitiesResult] = await Promise.all([
    client.from("profiles").select("id, display_name, privacy_preferences, yearly_goal, ranking_order, created_at, updated_at").single(),
    client.from("visits").select(`${VISIT_COLUMNS}, created_at, updated_at`).order("created_at"),
    client.from("visit_photographs").select("id, visit_id, storage_path, created_at").order("created_at"),
    client.from("wishlist_cities").select("id, city_name, country, continent, latitude, longitude, emoji, created_at").order("created_at"),
    client.from("personal_lists").select("id, title, position, created_at, updated_at").order("position"),
    client.from("personal_list_cities").select("id, list_id, visit_id, position, created_at").order("position")
  ]);
  const error = profileResult.error || visitsResult.error || photosResult.error || wishlistResult.error || listsResult.error || listCitiesResult.error;
  if (error) throw normaliseBackendError(error, "Could not prepare your data export.");
  return {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, created_at: user.created_at },
    profile: profileResult.data,
    visits: visitsResult.data,
    photographs: photosResult.data,
    want_to_visit: wishlistResult.data,
    personal_lists: listsResult.data,
    personal_list_cities: listCitiesResult.data
  };
}
