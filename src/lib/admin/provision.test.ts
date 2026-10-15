import { describe, expect, it } from "vitest";
import { describeDatabase, isLocalDatabase, planProvision, validateInitialPassword, type ExistingAccount } from "./provision";

const EMAIL = "admin@fxbothub.com";
const existing = (over: Partial<ExistingAccount> = {}): ExistingAccount => ({ role: "USER", hasPassword: true, createdAt: new Date("2026-09-01T00:00:00Z"), linkedProviders: [], ...over });

describe("validateInitialPassword", () => {
  it("requires the variable to be set", () => {
    expect(validateInitialPassword(undefined, EMAIL).ok).toBe(false);
    expect(validateInitialPassword("", EMAIL).ok).toBe(false);
  });
  it("rejects short, repetitive, common and email-derived passwords", () => {
    expect(validateInitialPassword("Short1!", EMAIL).ok).toBe(false);
    expect(validateInitialPassword("aaaaaaaaaaaaaaaa", EMAIL).ok).toBe(false);
    expect(validateInitialPassword("password123", EMAIL).ok).toBe(false);
    expect(validateInitialPassword("MyAdmin-Passw0rd!", EMAIL).ok).toBe(false); // contains "admin"
  });
  it("caps the length at what bcrypt actually uses", () => {
    expect(validateInitialPassword("x7Q!" + "kR9#".repeat(20), EMAIL).ok).toBe(false);
  });
  it("accepts a strong password", () => {
    expect(validateInitialPassword("c8Zr-Tq4!nB2xLw9", EMAIL)).toEqual({ ok: true });
  });
  it("never echoes the password back in an error", () => {
    const r = validateInitialPassword("short", EMAIL);
    expect(JSON.stringify(r)).not.toContain("short");
  });
});

describe("planProvision", () => {
  const none = { adopt: false, resetPassword: false };
  it("creates the account when it doesn't exist", () => {
    expect(planProvision(null, none)).toEqual({ kind: "create" });
  });
  it("leaves an existing Super Administrator and their password alone by default", () => {
    const plan = planProvision(existing({ role: "SUPER_ADMIN" }), none);
    expect(plan.kind).toBe("none");
  });
  it("only resets a Super Administrator's password when explicitly asked", () => {
    expect(planProvision(existing({ role: "SUPER_ADMIN" }), { adopt: false, resetPassword: true }).kind).toBe("reset_password");
  });
  it("never silently promotes someone else's account", () => {
    const plan = planProvision(existing({ role: "USER", linkedProviders: ["google"] }), none);
    expect(plan.kind).toBe("refuse");
    expect(plan.kind === "refuse" && plan.message).toMatch(/may not be yours/);
    expect(plan.kind === "refuse" && plan.message).toMatch(/--adopt/);
  });
  it("adopts an existing account only with --adopt, and warns about live sessions", () => {
    const plan = planProvision(existing({ role: "SELLER" }), { adopt: true, resetPassword: false });
    expect(plan.kind).toBe("adopt");
    expect(plan.kind === "adopt" && plan.warning).toMatch(/AUTH_SECRET/);
  });
});

describe("database helpers", () => {
  it("recognises local databases", () => {
    expect(isLocalDatabase("postgresql://u:p@localhost:5432/db")).toBe(true);
    expect(isLocalDatabase("postgresql://u:p@127.0.0.1/db")).toBe(true);
    expect(isLocalDatabase("postgresql://u:p@ep-x.neon.tech/db")).toBe(false);
    expect(isLocalDatabase(undefined)).toBe(false);
    expect(isLocalDatabase("not a url")).toBe(false);
  });
  it("describes a database without its credentials", () => {
    const d = describeDatabase("postgresql://someuser:s3cr3t@ep-x.neon.tech:5432/neondb?sslmode=require");
    expect(d).toBe("ep-x.neon.tech:5432/neondb");
    expect(d).not.toMatch(/s3cr3t|someuser/);
  });
});
