import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./auth-errors";

describe("authErrorMessage", () => {
  it("returns nothing when there is no error", () => {
    expect(authErrorMessage(undefined)).toBeNull();
    expect(authErrorMessage("")).toBeNull();
  });

  it("explains a refused Google sign-in without revealing whether an account exists", () => {
    const msg = authErrorMessage("AccessDenied")!;
    expect(msg).toMatch(/Google sign-in was refused/);
    expect(msg).not.toMatch(/no account|not registered|banned/i);
  });

  it("groups the OAuth transport failures into one retry message", () => {
    for (const code of ["OAuthSignin", "OAuthCallback", "OAuthCreateAccount", "Callback", "Configuration"]) {
      expect(authErrorMessage(code)).toMatch(/couldn't complete Google sign-in/);
    }
  });

  it("falls back to a generic message for unknown codes", () => {
    expect(authErrorMessage("Something")).toBe("Sign-in failed. Please try again.");
  });
});
