import { getBackendClient, requireCurrentUser } from "./client";
import { BackendError, normaliseBackendError } from "./errors";
import { fromVisitRow, toVisitRow, validateVisit, VISIT_COLUMNS, type StoredCity, type VisitRow } from "./model";

export async function loadVisits(): Promise<StoredCity[]> {
  const client = getBackendClient();
  await requireCurrentUser();
  const { data, error } = await client.from("visits").select(VISIT_COLUMNS).order("date_from", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw normaliseBackendError(error, "Could not load your visits.");
  return (data as VisitRow[] || []).map(fromVisitRow);
}

export async function createVisit(city: Omit<StoredCity, "id">, operationId = crypto.randomUUID()): Promise<StoredCity> {
  const validationError = validateVisit(city);
  if (validationError) throw new BackendError("VALIDATION", validationError);
  const client = getBackendClient();
  const user = await requireCurrentUser();
  const row = toVisitRow(city, user.id, operationId);
  const { data, error } = await client.from("visits").upsert(row, { onConflict: "id", ignoreDuplicates: false }).select(VISIT_COLUMNS).single();
  if (error) throw normaliseBackendError(error, "Could not save this visit.");
  return fromVisitRow(data as VisitRow);
}

export async function updateVisit(city: StoredCity): Promise<StoredCity> {
  const validationError = validateVisit(city);
  if (validationError) throw new BackendError("VALIDATION", validationError);
  const client = getBackendClient();
  const user = await requireCurrentUser();
  const row = toVisitRow(city, user.id, city.id);
  const { data, error } = await client.from("visits").update(row).eq("id", city.id).select(VISIT_COLUMNS).single();
  if (error) throw normaliseBackendError(error, "Could not update this visit.");
  return fromVisitRow(data as VisitRow);
}

export async function deleteVisit(id: string) {
  const client = getBackendClient();
  await requireCurrentUser();
  const { data, error } = await client.functions.invoke("delete-visit", { body: { visit_id: id } });
  if (error) throw normaliseBackendError(error, "Could not delete this visit.");
  if (!data?.deleted) throw new BackendError("UNKNOWN", "The visit deletion did not complete.");
}
