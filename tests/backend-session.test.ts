import { beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ getSession: vi.fn(), getUser: vi.fn() }));
vi.mock("../src/backend/supabase", () => ({ supabase: { auth } }));
import { requireCurrentUser } from "../src/backend/client";
const session = (id: string | null) => ({ data: { session: id ? { user: { id } } : null } });

beforeEach(() => vi.resetAllMocks());
describe("verified mutation identity", () => {
  it("rejects a stale handler even when the new session is internally consistent", async () => {
    auth.getSession.mockResolvedValue(session("bob"));
    auth.getUser.mockResolvedValue({data:{user:{id:"bob"}},error:null});
    await expect(requireCurrentUser("alice")).rejects.toMatchObject({code:"NOT_AUTHENTICATED"});
  });
  it("accepts the same authenticated account before and after verification", async () => {
    auth.getSession.mockResolvedValue(session("alice"));
    auth.getUser.mockResolvedValue({ data: { user: { id: "alice" } }, error: null });
    expect((await requireCurrentUser()).id).toBe("alice");
  });
  it("rejects a sign-out while identity verification is pending", async () => {
    auth.getSession.mockResolvedValueOnce(session("alice")).mockResolvedValueOnce(session(null));
    auth.getUser.mockResolvedValue({ data: { user: { id: "alice" } }, error: null });
    await expect(requireCurrentUser()).rejects.toMatchObject({ code: "NOT_AUTHENTICATED" });
  });
  it("rejects a different account returned during a session switch", async () => {
    auth.getSession.mockResolvedValueOnce(session("alice")).mockResolvedValueOnce(session("bob"));
    auth.getUser.mockResolvedValue({ data: { user: { id: "bob" } }, error: null });
    await expect(requireCurrentUser()).rejects.toMatchObject({ code: "NOT_AUTHENTICATED" });
  });
});
