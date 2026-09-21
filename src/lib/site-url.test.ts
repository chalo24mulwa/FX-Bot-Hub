import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveSiteUrl } from "./site-url";

afterEach(() => vi.restoreAllMocks());

describe("resolveSiteUrl", () => {
  it("uses NEXT_PUBLIC_APP_URL when it is a valid URL", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_APP_URL: "https://fxbothub.com" })).toBe("https://fxbothub.com");
  });

  it("strips one layer of wrapping quotes and whitespace", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_APP_URL: "'https://fxbothub.com'" })).toBe("https://fxbothub.com");
    expect(resolveSiteUrl({ NEXT_PUBLIC_APP_URL: ' "https://fxbothub.com" ' })).toBe("https://fxbothub.com");
  });

  it("falls back to NEXTAUTH_URL when the app URL is malformed (the production incident)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const glued = "'https://fxbothub.com'MARKET_DATA_API_KEY=super-secret-key-value";
    expect(resolveSiteUrl({ NEXT_PUBLIC_APP_URL: glued, NEXTAUTH_URL: "https://fxbothub.com" })).toBe("https://fxbothub.com");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("never writes the rejected value into the log", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    resolveSiteUrl({ NEXT_PUBLIC_APP_URL: "'https://x.com'MARKET_DATA_API_KEY=super-secret-key-value" });
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain("super-secret-key-value");
    expect(logged).toContain("NEXT_PUBLIC_APP_URL");
  });

  it("falls back to localhost when nothing usable is set", () => {
    expect(resolveSiteUrl({})).toBe("http://localhost:3000");
    expect(resolveSiteUrl({ NEXT_PUBLIC_APP_URL: "" })).toBe("http://localhost:3000");
  });

  it("treats an empty quoted value as unset (the other way this env file could break)", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_APP_URL: "''", NEXTAUTH_URL: "https://fxbothub.com" })).toBe("https://fxbothub.com");
  });

  it("only accepts http(s)", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveSiteUrl({ NEXT_PUBLIC_APP_URL: "javascript:alert(1)", NEXTAUTH_URL: "https://fxbothub.com" })).toBe(
      "https://fxbothub.com",
    );
  });
});
