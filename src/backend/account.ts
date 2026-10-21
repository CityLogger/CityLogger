import { getBackendClient, requireCurrentUser } from "./client";
import { normaliseBackendError } from "./errors";
import { VISIT_COLUMNS } from "./model";
import { fetchAllPages } from "./pagination";
import { geographicRead } from "./geography";

export async function downloadAccountData(expectedUserId?: string) {
  const client = getBackendClient();
  const user = await requireCurrentUser(expectedUserId);
  // RLS remains authoritative. Pin every page to the initiating owner as well:
  // a session switch must never mix another account's rows into this export.
  const [profileResult, visits, photographs, wantToVisit, personalLists, personalListCities] = await Promise.all([
    client.from("profiles").select("id, display_name, privacy_preferences, yearly_goal, ranking_order, wishlist_order, created_at, updated_at").eq("id", user.id).single(),
    fetchAllPages((from, to) => geographicRead(includeId => client.from("visits").select(`${VISIT_COLUMNS}, updated_at${includeId ? ", geoname_id" : ""}`).eq("user_id", user.id).order("created_at").order("id").range(from, to)), "Could not export visits."),
    fetchAllPages((from, to) => client.from("visit_photographs").select("id, visit_id, storage_path, created_at").eq("user_id", user.id).order("created_at").order("id").range(from, to), "Could not export photograph records."),
    fetchAllPages((from, to) => geographicRead(includeId => client.from("wishlist_cities").select("id, city_name, country, continent, latitude, longitude, emoji, created_at" + (includeId ? ", geoname_id" : "")).eq("user_id", user.id).order("created_at").order("id").range(from, to)), "Could not export Want to Visit cities."),
    fetchAllPages((from, to) => client.from("personal_lists").select("id, title, position, created_at, updated_at").eq("user_id", user.id).order("position").order("id").range(from, to), "Could not export personal lists."),
    fetchAllPages((from, to) => client.from("personal_list_cities").select("id, list_id, visit_id, position, created_at").eq("user_id", user.id).order("position").order("id").range(from, to), "Could not export list entries.")
  ]);
  if (profileResult.error) throw normaliseBackendError(profileResult.error, "Could not prepare your data export.");
  await requireCurrentUser(user.id);
  return {
    schema_version: 1,
    export_notes: { photograph_files_included: false, photographs: "Metadata only. Original private Storage files are not embedded in this JSON export." },
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, created_at: user.created_at },
    profile: profileResult.data,
    visits,
    photographs,
    want_to_visit: wantToVisit,
    personal_lists: personalLists,
    personal_list_cities: personalListCities
  };
}
