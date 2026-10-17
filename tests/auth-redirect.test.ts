import { afterEach, describe, expect, it, vi } from "vitest";
import { authRedirectUrl } from "../src/backend/supabase";

afterEach(() => vi.unstubAllEnvs());

describe("authentication email redirects", () => {
  it("uses the public site instead of a localhost preview", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3215");
    expect(authRedirectUrl()).toBe("https://citylogger.app");
  });

  it("uses the configured HTTPS production origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://citylogger.app/unused-path");
    expect(authRedirectUrl("/account")).toBe("https://citylogger.app/account");
  });
});
