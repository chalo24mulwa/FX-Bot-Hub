import { describe, expect, it } from "vitest";
import { signUpSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema } from "./auth";

describe("signUpSchema", () => {
  it("accepts a valid sign-up payload", () => {
    expect(signUpSchema.safeParse({ name: "Jo Trader", email: "jo@example.com", password: "password123" }).success).toBe(true);
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(signUpSchema.safeParse({ name: "Jo", email: "jo@example.com", password: "short" }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(signUpSchema.safeParse({ name: "Jo", email: "not-an-email", password: "password123" }).success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "jo@example.com" }).success).toBe(true);
  });

  it("rejects a missing/invalid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({}).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts a real-shaped token and a valid new password", () => {
    expect(resetPasswordSchema.safeParse({ token: "a".repeat(64), password: "newpassword123" }).success).toBe(true);
  });

  it("rejects a too-short token (rules out a guessable/truncated value)", () => {
    expect(resetPasswordSchema.safeParse({ token: "short", password: "newpassword123" }).success).toBe(false);
  });

  it("rejects a too-short new password", () => {
    expect(resetPasswordSchema.safeParse({ token: "a".repeat(64), password: "short" }).success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("accepts a valid current + new password pair", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "oldpassword", newPassword: "newpassword123" }).success).toBe(true);
  });

  it("rejects an empty current password", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "", newPassword: "newpassword123" }).success).toBe(false);
  });

  it("rejects a too-short new password", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "oldpassword", newPassword: "short" }).success).toBe(false);
  });
});
