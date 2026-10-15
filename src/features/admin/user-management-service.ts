import type { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { loadActor, changeUserRoleChecked, setUserSuspendedChecked } from "./user-admin-service";

export async function listUsers(page: number, pageSize: number, role?: UserRole) {
  const where = role ? { role } : {};
  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, name: true, email: true, role: true, bannedAt: true, createdAt: true },
    }),
    db.user.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

// These two used to write straight to the database, so any ADMIN could make
// themselves (or anyone) a SUPER_ADMIN and any moderator could ban an
// administrator. They now go through the same rule-checked path as the user
// detail page (src/lib/admin/rules.ts): you can only act on accounts you
// outrank, never on yourself, and the last active Super Administrator is
// protected. Kept as exports so existing callers still work.

export async function changeUserRole(actorId: string, userId: string, role: UserRole, ipAddress?: string) {
  const actor = await loadActor(actorId, ipAddress);
  await changeUserRoleChecked(actor, userId, role, "Changed from the legacy role selector.");
  return db.user.findUniqueOrThrow({ where: { id: userId } });
}

export async function setUserBanned(actorId: string, userId: string, banned: boolean, ipAddress?: string) {
  const actor = await loadActor(actorId, ipAddress);
  await setUserSuspendedChecked(actor, userId, banned, banned ? "Suspended from the legacy user list." : "");
  return db.user.findUniqueOrThrow({ where: { id: userId } });
}
