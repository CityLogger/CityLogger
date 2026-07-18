import { getBackendClient, requireCurrentUser } from "./client";
import { BackendError, normaliseBackendError } from "./errors";
import { validatePhoto } from "./model";

export async function uploadVisitPhoto(visitId: string, file: File) {
  const validationError = validatePhoto(file);
  if (validationError) throw new BackendError("VALIDATION", validationError);
  const client = getBackendClient();
  const user = await requireCurrentUser();
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${user.id}/${visitId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await client.storage.from("visit-photos").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw normaliseBackendError(uploadError, "Could not upload this photograph.");
  const { error: recordError } = await client.from("visit_photographs").insert({ user_id: user.id, visit_id: visitId, storage_path: path });
  if (recordError) {
    await client.storage.from("visit-photos").remove([path]);
    throw normaliseBackendError(recordError, "Could not attach this photograph.");
  }
  return path;
}

export async function createPhotoUrl(storagePath: string, expiresInSeconds = 3600) {
  const client = getBackendClient();
  await requireCurrentUser();
  const { data, error } = await client.storage.from("visit-photos").createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw normaliseBackendError(error, "Could not display this photograph.");
  return data.signedUrl;
}
