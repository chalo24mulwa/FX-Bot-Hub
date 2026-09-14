import { describe, expect, it } from "vitest";
import { can, canEditProduct } from "@/lib/authorization/permissions";
import { roleAtLeast, isSeller, isStaff, isAdmin } from "@/lib/authorization/roles";

describe("role hierarchy", () => {
  it("ranks roles from USER to SUPER_ADMIN", () => {
    expect(roleAtLeast("ADMIN", "MODERATOR")).toBe(true);
    expect(roleAtLeast("MODERATOR", "ADMIN")).toBe(false);
    expect(roleAtLeast("SUPER_ADMIN", "ADMIN")).toBe(true);
  });

  it("treats SELLER and AUTHOR as equal rank", () => {
    expect(isSeller("SELLER")).toBe(true);
    expect(isSeller("AUTHOR")).toBe(true);
    expect(isSeller("USER")).toBe(false);
  });

  it("staff includes MODERATOR, ADMIN, SUPER_ADMIN only", () => {
    expect(isStaff("MODERATOR")).toBe(true);
    expect(isStaff("ADMIN")).toBe(true);
    expect(isStaff("SELLER")).toBe(false);
  });

  it("admin includes ADMIN and SUPER_ADMIN only", () => {
    expect(isAdmin("ADMIN")).toBe(true);
    expect(isAdmin("SUPER_ADMIN")).toBe(true);
    expect(isAdmin("MODERATOR")).toBe(false);
  });
});

describe("permission matrix", () => {
  it("only staff can moderate products", () => {
    expect(can("USER", "product:moderate")).toBe(false);
    expect(can("SELLER", "product:moderate")).toBe(false);
    expect(can("MODERATOR", "product:moderate")).toBe(true);
    expect(can("ADMIN", "product:moderate")).toBe(true);
  });

  it("only sellers/authors/staff can create products", () => {
    expect(can("USER", "product:create")).toBe(false);
    expect(can("SELLER", "product:create")).toBe(true);
    expect(can("AUTHOR", "product:create")).toBe(true);
  });

  it("only admins can manage user roles", () => {
    expect(can("MODERATOR", "user:manage_roles")).toBe(false);
    expect(can("ADMIN", "user:manage_roles")).toBe(true);
  });
});

describe("canEditProduct (ownership-aware)", () => {
  it("lets a seller edit their own product", () => {
    expect(canEditProduct("SELLER", true)).toBe(true);
  });

  it("blocks a seller from editing someone else's product", () => {
    expect(canEditProduct("SELLER", false)).toBe(false);
  });

  it("lets staff edit any product regardless of ownership", () => {
    expect(canEditProduct("ADMIN", false)).toBe(true);
  });
});
