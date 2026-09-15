import { db } from "@/lib/db";
import type { Prisma, SecurityEventSeverity, SecurityEventType } from "@prisma/client";

export interface RecordSecurityEventInput {
  userId?: string;
  type: SecurityEventType;
  severity?: SecurityEventSeverity;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
}

/** Signal, don't act: this only ever logs. Nothing in this codebase reads
 * a SecurityEvent and automatically bans/suspends a user — see the
 * SecurityEvent model comment and CLAUDE.md's fraud/security section. An
 * admin decides what, if anything, to do about what's logged here. */
export async function recordSecurityEvent(input: RecordSecurityEventInput) {
  return db.securityEvent.create({
    data: { severity: "LOW", ...input },
  });
}

export async function listSecurityEvents(page: number, pageSize: number) {
  const [items, total] = await Promise.all([
    db.securityEvent.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { name: true, email: true } } },
    }),
    db.securityEvent.count(),
  ]);
  return { items, total, page, pageSize };
}
