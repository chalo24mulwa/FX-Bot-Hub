import { headers } from "next/headers";
import { ZodError } from "zod";
import type { AdminRole, UserRole } from "@prisma/client";
import { AuthorizationError, requirePermission } from "@/lib/authorization";
import type { Action } from "@/lib/authorization/permissions";
import { checkRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { logger } from "@/lib/logger";
import { PartnershipError } from "@/features/partnership/core";

/** An expected, user-presentable failure — actions turn it into `{ ok: false, error }`. */
export class AdminError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type AdminResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface AdminActor {
  id: string;
  role: UserRole;
  adminRoles: AdminRole[];
  ipAddress?: string;
}

/** Best-effort client IP for the audit log (the same header the rest of the app trusts). */
export async function requestIp(): Promise<string | undefined> {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
  } catch {
    return undefined;
  }
}

function toResult(err: unknown): { ok: false; error: string } {
  if (err instanceof AdminError || err instanceof PartnershipError) return { ok: false, error: err.message };
  if (err instanceof AuthorizationError) {
    return { ok: false, error: err.status === 401 ? "Please sign in to do that." : "You don't have permission to do that." };
  }
  if (err instanceof RateLimitError) return { ok: false, error: "You're doing that too quickly. Please wait a moment." };
  if (err instanceof ZodError) return { ok: false, error: err.issues[0]?.message ?? "Something in that request isn't valid." };
  if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2034") {
    return { ok: false, error: "Another change happened at the same time. Please try again." };
  }
  logger.error("admin action failed", { error: err instanceof Error ? err.message : String(err) });
  return { ok: false, error: "Something went wrong. Please try again." };
}

/**
 * Runs an admin server action: re-checks the permission on every call (the page
 * gate is never the only guard), optionally rate-limits per administrator, and
 * converts expected failures to `{ ok: false, error }`.
 */
export async function runAdminAction<T extends object>(
  action: Action,
  fn: (actor: AdminActor) => Promise<T>,
  options: { rateLimit?: { bucket: string; limit: number; windowSeconds: number } } = {},
): Promise<AdminResult<T>> {
  try {
    const session = await requirePermission(action);
    if (options.rateLimit) await checkRateLimit(session.user.id, options.rateLimit);
    const actor: AdminActor = {
      id: session.user.id,
      role: session.user.role,
      adminRoles: session.user.adminRoles ?? [],
      ipAddress: await requestIp(),
    };
    return { ok: true, ...(await fn(actor)) };
  } catch (err) {
    return toResult(err);
  }
}
