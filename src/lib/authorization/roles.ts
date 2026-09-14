import type { UserRole } from "@prisma/client";

// Low -> high privilege. SELLER and AUTHOR sit at the same rank (both are
// "can publish products" roles; AUTHOR additionally implies original/vetted
// content in the UI, not a broader permission set).
const ROLE_RANK: Record<UserRole, number> = {
  USER: 0,
  SELLER: 1,
  AUTHOR: 1,
  MODERATOR: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

export function roleAtLeast(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export const SELLER_ROLES: UserRole[] = ["SELLER", "AUTHOR"];
export const STAFF_ROLES: UserRole[] = ["MODERATOR", "ADMIN", "SUPER_ADMIN"];
export const ADMIN_ROLES: UserRole[] = ["ADMIN", "SUPER_ADMIN"];

export function isSeller(role: UserRole): boolean {
  return SELLER_ROLES.includes(role) || STAFF_ROLES.includes(role);
}

export function isStaff(role: UserRole): boolean {
  return STAFF_ROLES.includes(role);
}

export function isAdmin(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}
