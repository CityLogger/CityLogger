import { getBackendClient, requireCurrentUser } from "./client";
import { BackendError, normaliseBackendError } from "./errors";
import { fromVisitRow, toVisitRow, validateVisit, VISIT_COLUMNS, type StoredCity, type VisitRow } from "./model";
import { fetchAllPages } from "./pagination";
import { geographicRead } from "./geography";

export async function loadVisits(expectedUserId?: string): Promise<StoredCity[]> {
  const client = getBackendClient();
  const user = await requireCurrentUser(expectedUserId);
  const rows = await fetchAllPages<VisitRow>(
    (from, to) => geographicRead(includeId => client.from("visits").select(VISIT_COLUMNS + (includeId ? ", geoname_id" : "")).eq("user_id", user.id).order("date_from", { ascending: false }).order("created_at", { ascending: false }).order("id").range(from, to)),
    "Could not load your visits."
  );
  await requireCurrentUser(user.id);
  return rows.map(fromVisitRow);
}

export async function createVisit(city: Omit<StoredCity, "id">, operationId = crypto.randomUUID(), expectedUserId?: string): Promise<StoredCity> {
  const validationError = validateVisit(city);
  if (validationError) throw new BackendError("VALIDATION", validationError);
  const client = getBackendClient();
  const user = await requireCurrentUser(expectedUserId);
  const row = toVisitRow(city, user.id, operationId);
  const { data, error } = await client.from("visits").upsert(row, { onConflict: "id", ignoreDuplicates: true }).select(VISIT_COLUMNS).maybeSingle();
  if (error) throw normaliseBackendError(error, "Could not save this visit.");
  if (!data) {
    // A retry must never overwrite a visit edited since its original creation.
    const existing = await client.from("visits").select(VISIT_COLUMNS + (city.geonameId ? ", geoname_id" : "")).eq("id", operationId).eq("user_id", user.id).single();
    if (existing.error) throw normaliseBackendError(existing.error, "Could not verify the saved visit.");
    return fromVisitRow(existing.data as unknown as VisitRow);
  }
  return { ...fromVisitRow(data as VisitRow), ...(city.geonameId ? { geonameId: city.geonameId } : {}) };
}

export async function updateVisit(city: StoredCity, expectedUserId?: string): Promise<StoredCity> {
  const validationError = validateVisit(city);
  if (validationError) throw new BackendError("VALIDATION", validationError);
  const client = getBackendClient();
  const user = await requireCurrentUser(expectedUserId);
  const row = toVisitRow(city, user.id, city.id);
  const { data, error } = await client.from("visits").update(row).eq("id", city.id).select(VISIT_COLUMNS).single();
  if (error) throw normaliseBackendError(error, "Could not update this visit.");
  return { ...fromVisitRow(data as VisitRow), ...(city.geonameId ? { geonameId: city.geonameId } : {}) };
}

export async function deleteVisit(id: string, expectedUserId?: string) {
  const client = getBackendClient();
  await requireCurrentUser(expectedUserId);
  const { data, error } = await client.functions.invoke("delete-visit", { body: { visit_id: id } });
  if (error) throw normaliseBackendError(error, "Could not delete this visit.");
  if (!data?.deleted) throw new BackendError("UNKNOWN", "The visit deletion did not complete.");
  return { cleanupPending: Boolean(data.storage_cleanup_pending) };
}
