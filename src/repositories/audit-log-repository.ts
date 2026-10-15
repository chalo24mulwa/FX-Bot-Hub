import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface RecordAuditLogInput {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  /** Set for anything done inside an admin's "view as user" session. */
  impersonationSessionId?: string;
}

// The audit log is append-only: this module deliberately has no update or
// delete function, and nothing else in the app writes to the table.
export async function recordAuditLog(input: RecordAuditLogInput) {
  return db.auditLog.create({ data: input });
}

export interface AuditLogFilter {
  /** Matches the acting user's email (contains, case-insensitive). */
  actor?: string;
  /** Exact action, or a prefix when it ends with "." or "*" (e.g. "impersonation."). */
  action?: string;
  entityType?: string;
  entityId?: string;
  impersonationSessionId?: string;
  from?: Date;
  to?: Date;
}

export function buildAuditLogWhere(filter: AuditLogFilter = {}): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (filter.actor) where.actor = { email: { contains: filter.actor.trim(), mode: "insensitive" } };
  if (filter.action) {
    const raw = filter.action.trim();
    const prefix = raw.endsWith("*") ? raw.slice(0, -1) : raw.endsWith(".") ? raw : null;
    where.action = prefix !== null ? { startsWith: prefix } : raw;
  }
  if (filter.entityType) where.entityType = filter.entityType.trim();
  if (filter.entityId) where.entityId = filter.entityId.trim();
  if (filter.impersonationSessionId) where.impersonationSessionId = filter.impersonationSessionId.trim();
  if (filter.from || filter.to) where.createdAt = { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) };
  return where;
}

export async function listAuditLogs(page: number, pageSize: number, filter: AuditLogFilter = {}) {
  const where = buildAuditLogWhere(filter);
  const [items, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { name: true, email: true } } },
    }),
    db.auditLog.count({ where }),
  ]);
  return { items, total, page, pageSize };
}
