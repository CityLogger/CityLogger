import { describe, expect, it } from "vitest";
import { fetchAllPages } from "../src/backend/pagination";

describe("backend pagination", () => {
  it("returns every row across the page boundary", async () => {
    const source = Array.from({ length: 1001 }, (_, id) => ({ id }));
    const ranges: Array<[number, number]> = [];
    const rows = await fetchAllPages(async (from, to) => {
      ranges.push([from, to]);
      return { data: source.slice(from, to + 1), error: null };
    }, "Could not load rows.");
    expect(rows).toEqual(source);
    expect(ranges).toEqual([[0, 499], [500, 999], [1000, 1499]]);
  });

  it("fails rather than returning a silently truncated export", async () => {
    await expect(fetchAllPages(async (from) => ({
      data: from ? null : Array.from({ length: 500 }, (_, id) => ({ id })),
      error: from ? { message: "Page unavailable" } : null
    }), "Could not export rows.")).rejects.toThrow("Page unavailable");
  });
});
