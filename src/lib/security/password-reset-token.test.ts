import { describe, expect, it } from "vitest";
import { generateResetToken, hashResetToken } from "./password-reset-token";

describe("password reset tokens", () => {
  it("hashResetToken is deterministic for the same input", () => {
    expect(hashResetToken("same-token")).toBe(hashResetToken("same-token"));
  });

  it("hashResetToken produces different hashes for different inputs", () => {
    expect(hashResetToken("token-a")).not.toBe(hashResetToken("token-b"));
  });

  it("hashResetToken never returns the raw input back (not stored in plaintext)", () => {
    const hash = hashResetToken("my-secret-token");
    expect(hash).not.toBe("my-secret-token");
    expect(hash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex digest
  });

  it("generateResetToken's returned tokenHash matches hashing the returned token", () => {
    const { token, tokenHash } = generateResetToken();
    expect(hashResetToken(token)).toBe(tokenHash);
  });

  it("generateResetToken produces a sufficiently long, unpredictable raw token", () => {
    const { token } = generateResetToken();
    expect(token.length).toBeGreaterThanOrEqual(48); // 32 random bytes, hex-encoded = 64 chars
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it("generateResetToken never repeats across calls", () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateResetToken().token));
    expect(seen.size).toBe(50);
  });
});
