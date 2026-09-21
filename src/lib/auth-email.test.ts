import { describe, expect, it, vi } from "vitest";

// findUserByEmail touches the database; the pure helper is what is unit-tested here
// (the lookup itself is exercised against Postgres by the auth e2e/integration runs).
vi.mock("@/lib/db", () => ({ db: {} }));

import { normalizeEmail } from "./auth-email";

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Foo@Gmail.COM ")).toBe("foo@gmail.com");
  });

  it("leaves an already-normal address unchanged", () => {
    expect(normalizeEmail("user@example.com")).toBe("user@example.com");
  });
});
