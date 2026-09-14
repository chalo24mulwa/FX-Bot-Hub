import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface RecordAuditLogInput {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
}

export async function recordAuditLog(input: RecordAuditLogInput) {
  return db.auditLog.create({ data: input });
}

export async function listAuditLogs(page: number, pageSize: number) {
  const [items, total] = await Promise.all([
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { name: true, email: true } } },
    }),
    db.auditLog.count(),
  ]);
  return { items, total, page, pageSize };
}
