import { getBackendClient, requireCurrentUser } from "./client";
import { normaliseBackendError } from "./errors";
import { VISIT_COLUMNS } from "./model";

export async function downloadAccountData() {
  const client = getBackendClient();
  const user = await requireCurrentUser();
  const [profileResult, visitsResult, photosResult] = await Promise.all([
    client.from("profiles").select("id, display_name, privacy_preferences, created_at, updated_at").single(),
    client.from("visits").select(`${VISIT_COLUMNS}, created_at, updated_at`).order("created_at"),
    client.from("visit_photographs").select("id, visit_id, storage_path, created_at").order("created_at")
  ]);
  const error = profileResult.error || visitsResult.error || photosResult.error;
  if (error) throw normaliseBackendError(error, "Could not prepare your data export.");
  return {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, created_at: user.created_at },
    profile: profileResult.data,
    visits: visitsResult.data,
    photographs: photosResult.data
  };
}
