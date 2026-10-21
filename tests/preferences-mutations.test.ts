import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), requireUser: vi.fn() }));
vi.mock("../src/backend/client", () => ({ getBackendClient: () => ({ from: mocks.from }), requireCurrentUser: mocks.requireUser }));
import { addWishlistCity, createPersonalList, removeWishlistCity } from "../src/backend/preferences";

type ListRecord = { id: string; user_id: string; title: string; position: number };
type EntryRecord = { id: string; user_id: string; list_id: string; visit_id: string; position: number; created_at: string };

function listBackend(lists: ListRecord[] = [], entries: EntryRecord[] = []) {
  const state = { lists, entries, insertError: null as unknown, readbackError: null as unknown, entriesError: null as unknown };
  const queries: Array<{ table: string; filters: Record<string, string>; orders: string[]; range: ReturnType<typeof vi.fn> }> = [];
  const insert = vi.fn();
  mocks.from.mockImplementation((table: string) => {
    const filters: Record<string, string> = {};
    const orders: string[] = [];
    let draft: ListRecord;
    let ignoreDuplicates = false;
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((column: string, value: string) => { filters[column] = value; return builder; }),
      order: vi.fn((column: string) => { orders.push(column); return builder; }),
      upsert: (row: ListRecord, options: { onConflict: string; ignoreDuplicates?: boolean }) => {
        insert(row, options);
        draft = row;
        ignoreDuplicates = Boolean(options.ignoreDuplicates);
        return builder;
      },
      maybeSingle: async () => {
        if (state.insertError) return { data: null, error: state.insertError };
        const existing = state.lists.find(row => row.id === draft.id);
        if (existing && ignoreDuplicates) return { data: null, error: null };
        if (existing) Object.assign(existing, draft);
        else state.lists.push({ ...draft });
        return { data: draft, error: null };
      },
      single: async () => {
        const data = state.lists.find(row => Object.entries(filters).every(([key, value]) => row[key as keyof ListRecord] === value));
        return { data: data || null, error: state.readbackError || (data ? null : { code: "PGRST116" }) };
      },
      range: vi.fn(async (from: number, to: number) => ({
        data: state.entries.filter(row => Object.entries(filters).every(([key, value]) => row[key as keyof EntryRecord] === value))
          .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
          .slice(from, to + 1),
        error: state.entriesError
      }))
    };
    queries.push({ table, filters, orders, range: builder.range });
    return builder;
  });
  return { state, queries, insert };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireUser.mockResolvedValue({ id: "alice" });
});

describe("personal-list creation retries", () => {
  it("creates a trimmed, empty list and preserves later cloud edits and all memberships on retry", async () => {
    const backend = listBackend();
    expect(await createPersonalList("  Original  ", 0, "list", "alice")).toEqual({ id: "list", title: "Original", cityIds: [] });
    Object.assign(backend.state.lists[0], { title: "Renamed in cloud", position: 7 });
    const entries = Array.from({ length: 501 }, (_, index) => ({
      id: `entry-${index}`, user_id: "alice", list_id: "list", visit_id: `visit-${index}`, position: index, created_at: "2026-01-01"
    }));
    backend.state.entries.push(...entries.toReversed(),
      { ...entries[0], id: "other-owner", user_id: "bob", visit_id: "private-visit" },
      { ...entries[0], id: "other-list", list_id: "other", visit_id: "other-visit" });

    expect(await createPersonalList("Original", 0, "list", "alice")).toEqual({
      id: "list", title: "Renamed in cloud", cityIds: entries.map(entry => entry.visit_id)
    });
    expect(backend.state.lists).toEqual([{ id: "list", user_id: "alice", title: "Renamed in cloud", position: 7 }]);
    expect(backend.insert).toHaveBeenNthCalledWith(2,
      { id: "list", user_id: "alice", title: "Original", position: 0 }, { onConflict: "id", ignoreDuplicates: true });
    expect(backend.queries[2].filters).toEqual({ id: "list", user_id: "alice" });
    const entryQueries = backend.queries.filter(query => query.table === "personal_list_cities");
    expect(entryQueries.map(query => query.range.mock.calls[0])).toEqual([[0, 499], [500, 999]]);
    for (const query of entryQueries) {
      expect(query.filters).toEqual({ list_id: "list", user_id: "alice" });
      expect(query.orders).toEqual(["position", "created_at", "id"]);
    }
    expect(mocks.requireUser).toHaveBeenCalledWith("alice");
  });

  it("propagates an insert failure without reading back or claiming success", async () => {
    const backend = listBackend();
    backend.state.insertError = { message: "insert failed" };
    await expect(createPersonalList("Title", 0, "list", "alice")).rejects.toMatchObject({ code: "DATABASE", message: "Could not create this list." });
    expect(backend.state.lists).toEqual([]);
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it("propagates a failed readback without returning an empty or stale list", async () => {
    const backend = listBackend([{ id: "list", user_id: "alice", title: "Cloud title", position: 4 }]);
    backend.state.readbackError = { message: "read failed" };
    await expect(createPersonalList("Old title", 0, "list", "alice")).rejects.toMatchObject({ code: "DATABASE", message: "Could not verify the saved list." });
    expect(mocks.from).not.toHaveBeenCalledWith("personal_list_cities");
  });

  it("fails if list memberships cannot be read back", async () => {
    const backend = listBackend([{ id: "list", user_id: "alice", title: "Cloud title", position: 4 }]);
    backend.state.entriesError = { message: "entries failed" };
    await expect(createPersonalList("Old title", 0, "list", "alice")).rejects.toMatchObject({ code: "DATABASE", message: "Could not load your list entries." });
  });

  it("never returns or overwrites a conflicting list owned by someone else", async () => {
    const backend = listBackend([{ id: "list", user_id: "bob", title: "Private list", position: 4 }]);
    await expect(createPersonalList("My title", 0, "list", "alice")).rejects.toMatchObject({ code: "DATABASE", message: "Could not verify the saved list." });
    expect(backend.queries[1].filters).toEqual({ id: "list", user_id: "alice" });
    expect(backend.state.lists[0]).toEqual({ id: "list", user_id: "bob", title: "Private list", position: 4 });
    expect(mocks.from).not.toHaveBeenCalledWith("personal_list_cities");
  });
});

describe("wishlist mutations", () => {
  it("scopes deletion to both the saved city and the current account", async () => {
    const builder = { delete: vi.fn(() => builder), eq: vi.fn(() => builder), then: (resolve: (value: { error: null }) => unknown) => resolve({ error: null }) };
    mocks.from.mockReturnValue(builder);
    await removeWishlistCity({ id: "city", name: "City", country: "Country" }, "alice");
    expect(mocks.from).toHaveBeenCalledWith("wishlist_cities");
    expect(builder.eq.mock.calls).toEqual([["id", "city"], ["user_id", "alice"]]);
    expect(mocks.requireUser).toHaveBeenCalledWith("alice");
  });

  it("rejects invalid wishlist coordinates before authenticating or writing", async () => {
    await expect(addWishlistCity({ name: "City", country: "Country", continent: "Europe", lat: 91, lng: 0, emoji: "" }, "alice"))
      .rejects.toMatchObject({ code: "VALIDATION", message: "City coordinates are invalid." });
    expect(mocks.requireUser).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("maps location fields and preserves a supplied geographic identifier", async () => {
    const row = { id: "city", city_name: "City", country: "Country", continent: "Europe", latitude: 1, longitude: 2, emoji: "" };
    const builder = { upsert: vi.fn(() => builder), select: vi.fn(() => builder), single: async () => ({ data: row, error: null }) };
    mocks.from.mockReturnValue(builder);
    expect(await addWishlistCity({ name: " City ", country: " Country ", continent: " Europe ", lat: 1, lng: 2, emoji: "", geonameId: "123" }, "alice"))
      .toEqual({ id: "city", name: "City", country: "Country", continent: "Europe", lat: 1, lng: 2, emoji: "", geonameId: "123" });
    expect(builder.upsert).toHaveBeenCalledWith({ user_id: "alice", city_name: "City", country: "Country", continent: "Europe", latitude: 1, longitude: 2, emoji: "", geoname_id: "123" },
      { onConflict: "user_id,city_name,country,latitude,longitude" });
  });
});
