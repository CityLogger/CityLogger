import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), requireUser: vi.fn() }));
vi.mock("../src/backend/client", () => ({ getBackendClient: () => ({ from: mocks.from }), requireCurrentUser: mocks.requireUser }));
import { loadAppState } from "../src/backend/preferences";

beforeEach(() => { vi.clearAllMocks(); mocks.requireUser.mockResolvedValue({id:"alice"}); });

describe("account collections", () => {
  it("loads more than 1000 entries and preserves the wishlist and list ordering", async () => {
    const entries = Array.from({ length: 1001 }, (_, id) => ({ list_id: "list", visit_id: `visit-${id}` }));
    const ranges: Array<[number, number]> = [];
    mocks.from.mockImplementation((table: string) => {
      const builder = {
        select: vi.fn(() => builder), order: vi.fn(() => builder), eq: vi.fn(() => builder),
        single: async () => ({ data: { display_name: "Traveller", yearly_goal: 10, ranking_order: ["visit-2"], wishlist_order: ["b", "a"] }, error: null }),
        range: async (from: number, to: number) => {
          if (table === "personal_list_cities") ranges.push([from, to]);
          const rows = table === "personal_list_cities" ? entries : table === "personal_lists" ? [{ id: "list", title: "Favourites" }] : ["a", "b"].map(id => ({ id, city_name: id, country: "Country", continent: "Europe", latitude: 0, longitude: 0, emoji: "" }));
          return { data: rows.slice(from, to + 1), error: null };
        }
      };
      return builder;
    });
    const result = await loadAppState();
    expect(result.lists[0].cityIds).toEqual(entries.map(row => row.visit_id));
    expect(result.wishlist.map(city => city.id)).toEqual(["b", "a"]);
    expect(result.rankingOrder).toEqual(["visit-2"]);
    expect(ranges).toEqual([[0, 499], [500, 999], [1000, 1499]]);
  });
});
