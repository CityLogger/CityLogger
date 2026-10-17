type PhotoRow = { storage_path: string };
type PhotoPage = { data: PhotoRow[] | null; error: unknown };

/** Metadata is user-writable. Never trust it to authorise service-role deletion. */
export function isOwnedPhotoPath(path: string, userId: string, visitId?: string): boolean {
  const parts = path.split("/");
  return parts.length >= 3 && parts[0] === userId &&
    (!visitId || parts[1] === visitId) &&
    parts.every(part => part !== "" && part !== "." && part !== ".." && !part.includes("\\"));
}

/** Validate the complete set before deleting anything; keep database rows for retries. */
export async function cleanupPhotos(
  fetchPage: (from: number, to: number) => PromiseLike<PhotoPage>,
  remove: (paths: string[]) => PromiseLike<{ error: unknown }>,
  userId: string,
  visitId?: string
): Promise<void> {
  const paths: string[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error("Could not inspect attached photographs");
    const page = data || [];
    for (const row of page) {
      if (!isOwnedPhotoPath(row.storage_path, userId, visitId)) {
        throw new Error("Photograph ownership could not be verified; contact support");
      }
      paths.push(row.storage_path);
    }
    if (page.length < pageSize) break;
  }
  for (let offset = 0; offset < paths.length; offset += 100) {
    const { error } = await remove(paths.slice(offset, offset + 100));
    if (error) throw new Error("Could not remove attached photographs; please retry");
  }
}

export function validVisitId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("visit_id" in payload)) return null;
  const id = payload.visit_id;
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
}
