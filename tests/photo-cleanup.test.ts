import { describe, expect, it, vi } from "vitest";
import { cleanupPhotos, isOwnedPhotoPath, validVisitId } from "../supabase/functions/_shared/photo-cleanup";

describe("privileged photograph cleanup", () => {
  it("rejects another user's path, another visit, and ambiguous path segments", () => {
    expect(isOwnedPhotoPath("alice/visit/photo.jpg", "alice", "visit")).toBe(true);
    for (const path of ["bob/visit/photo.jpg", "alice/other/photo.jpg", "alice/visit/../photo.jpg", "alice/visit//photo.jpg", "alice/visit/..\\photo.jpg"]) {
      expect(isOwnedPhotoPath(path, "alice", "visit")).toBe(false);
    }
  });

  it("checks later pages before making any privileged deletion", async () => {
    const source = [...Array.from({ length: 500 }, (_, id) => ({ storage_path: `alice/visit/${id}.jpg` })), { storage_path: "bob/visit/private.jpg" }];
    const remove = vi.fn(async () => ({ error: null }));
    await expect(cleanupPhotos(async (from, to) => ({ data: source.slice(from, to + 1), error: null }), remove, "alice")).rejects.toThrow("ownership");
    expect(remove).not.toHaveBeenCalled();
  });

  it("reads beyond the API row limit and deletes in bounded batches", async () => {
    const source = Array.from({ length: 1001 }, (_, id) => ({ storage_path: `alice/visit/${id}.jpg` }));
    const remove = vi.fn(async (_paths: string[]) => ({ error: null }));
    await cleanupPhotos(async (from, to) => ({ data: source.slice(from, to + 1), error: null }), remove, "alice");
    expect(remove.mock.calls.flatMap(([paths]) => paths)).toEqual(source.map(row => row.storage_path));
    expect(remove.mock.calls.every(([paths]) => paths.length <= 100)).toBe(true);
  });

  it("stops on storage failure so callers retain database records for retry", async () => {
    await expect(cleanupPhotos(async () => ({ data: [{ storage_path: "alice/visit/photo.jpg" }], error: null }), async () => ({ error: new Error("unavailable") }), "alice")).rejects.toThrow("retry");
  });

  it("does not delete anything when metadata retrieval fails", async () => {
    const remove = vi.fn();
    await expect(cleanupPhotos(async () => ({ data: null, error: new Error("unavailable") }), remove, "alice")).rejects.toThrow("inspect");
    expect(remove).not.toHaveBeenCalled();
  });

  it("handles malformed deletion payloads without throwing", () => {
    for (const value of [null, undefined, [], "id", { visit_id: 1 }, { visit_id: "invalid" }]) expect(validVisitId(value)).toBeNull();
    const id = "12345678-1234-1234-1234-123456789abc";
    expect(validVisitId({ visit_id: id })).toBe(id);
  });
});
