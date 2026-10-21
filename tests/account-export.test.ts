import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackendError } from "../src/backend/errors";

const mocks = vi.hoisted(() => ({ from: vi.fn(), user: vi.fn() }));
vi.mock("../src/backend/client", () => ({
  getBackendClient: () => ({ from: mocks.from }), requireCurrentUser: mocks.user
}));
import { downloadAccountData } from "../src/backend/account";

type QueryCall = { table: string; filters: Array<[string, string]>; range?: [number, number] };

function exportBackend(options: { failingPage?: boolean; missingGeography?: boolean; profileError?: boolean } = {}) {
  const calls: QueryCall[] = [];
  const visits = Array.from({ length: 501 }, (_, id) => ({ id: `visit-${id}`, note: `Memory ${id}` }));
  mocks.from.mockImplementation((table: string) => {
    const filters: Array<[string, string]> = [];
    let columns = "";
    const builder = {
      select: vi.fn((value: string) => { columns = value; return builder; }),
      eq: vi.fn((key: string, value: string) => { filters.push([key, value]); return builder; }),
      order: vi.fn(() => builder),
      single: async () => {
        calls.push({ table, filters: [...filters] });
        return { data: { id: "alice", display_name: "Alice" }, error: options.profileError ? { code: "42501" } : null };
      },
      range: async (from: number, to: number) => {
        calls.push({ table, filters: [...filters], range: [from, to] });
        if (options.missingGeography && columns.includes("geoname_id")) {
          return { data: null, error: { code: "42703", message: "geoname_id missing" } };
        }
        if (options.failingPage && table === "visits" && from > 0) {
          return { data: null, error: { code: "UNAVAILABLE" } };
        }
        const source = table === "visits" ? visits : [{ id: `${table}-row` }];
        return { data: source.slice(from, to + 1), error: null };
      }
    };
    return builder;
  });
  return { calls, visits };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "alice", email: "alice@example.test", created_at: "2026-01-01" });
});

describe("account export ownership and completeness", () => {
  it("pins every table and page to the initiating owner, including legacy-schema retries", async () => {
    const { calls, visits } = exportBackend({ missingGeography: true });
    const result = await downloadAccountData("alice");
    expect(result.visits).toEqual(visits);
    expect(result.account.id).toBe("alice");
    expect(result.export_notes.photograph_files_included).toBe(false);
    expect(result.photographs).toHaveLength(1);
    expect(result.want_to_visit).toHaveLength(1);
    expect(result.personal_lists).toHaveLength(1);
    expect(result.personal_list_cities).toHaveLength(1);
    expect(new Set(calls.map(call => call.table)).size).toBe(6);
    for (const call of calls) {
      expect(call.filters).toContainEqual([call.table === "profiles" ? "id" : "user_id", "alice"]);
    }
    expect(calls.some(call => call.table === "visits" && call.range?.[0] === 500)).toBe(true);
    expect(mocks.user.mock.calls).toEqual([["alice"], ["alice"]]);
  });

  it("does not return a partial export when a later page fails", async () => {
    exportBackend({ failingPage: true });
    await expect(downloadAccountData("alice")).rejects.toThrow("Could not export visits.");
  });

  it("does not return an export when profile retrieval fails", async () => {
    exportBackend({ profileError: true });
    await expect(downloadAccountData("alice")).rejects.toBeInstanceOf(BackendError);
  });

  it("discards results if the active account changed during export", async () => {
    exportBackend();
    mocks.user.mockResolvedValueOnce({ id: "alice" }).mockRejectedValueOnce(new BackendError("NOT_AUTHENTICATED", "Account changed."));
    await expect(downloadAccountData("alice")).rejects.toMatchObject({ code: "NOT_AUTHENTICATED" });
  });

  it("does not query any data when the initiating account is no longer signed in", async () => {
    mocks.user.mockRejectedValueOnce(new BackendError("NOT_AUTHENTICATED", "Account changed."));
    await expect(downloadAccountData("alice")).rejects.toMatchObject({ code: "NOT_AUTHENTICATED" });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
