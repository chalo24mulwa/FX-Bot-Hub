import type { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { recordAuditLog } from "@/repositories/audit-log-repository";

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

export async function changeUserRole(actorId: string, userId: string, role: UserRole, ipAddress?: string) {
  const updated = await db.user.update({ where: { id: userId }, data: { role } });
  await recordAuditLog({
    actorId,
    action: "user.role_change",
    entityType: "User",
    entityId: userId,
    metadata: { role },
    ipAddress,
  });
  return updated;
}

export async function setUserBanned(actorId: string, userId: string, banned: boolean, ipAddress?: string) {
  const updated = await db.user.update({
    where: { id: userId },
    data: { bannedAt: banned ? new Date() : null },
  });
  await recordAuditLog({
    actorId,
    action: banned ? "user.ban" : "user.unban",
    entityType: "User",
    entityId: userId,
    ipAddress,
  });
  return updated;
}
