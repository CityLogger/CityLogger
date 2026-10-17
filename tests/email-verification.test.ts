import { describe, expect, it } from "vitest";
import { cleanEmailOtpInput, emailOtpLength } from "../src/frontend/emailVerification";

describe("email verification code input", () => {
  it("accepts all eight digits of a pasted code with spaces", () => {
    expect(cleanEmailOtpInput("1234 5678")).toBe("12345678");
  });

  it("removes punctuation and limits input to the configured length", () => {
    expect(cleanEmailOtpInput("12-34-56-78-90")).toBe("12345678");
    expect(emailOtpLength).toBe(8);
  });
});
