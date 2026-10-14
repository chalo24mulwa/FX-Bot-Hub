import { ZodError } from "zod";
import { AuthorizationError, requirePermission, requireSession } from "@/lib/authorization";
import { checkRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { logger } from "@/lib/logger";
import { PartnershipError, type ActionResult } from "./core";

// Server actions never throw expected failures at the client; they resolve to
// `{ ok: false, error }`. Same shape as the Community actions.

function toResult(err: unknown): { ok: false; error: string } {
  if (err instanceof PartnershipError) return { ok: false, error: err.message };
  if (err instanceof AuthorizationError) return { ok: false, error: err.status === 401 ? "Please sign in to do that." : "You don't have permission to do that." };
  if (err instanceof RateLimitError) return { ok: false, error: "You're doing that too quickly. Please wait a moment." };
  if (err instanceof ZodError) return { ok: false, error: "Something in that request isn't valid. Please check it and try again." };
  logger.error("partnership action failed", { error: err instanceof Error ? err.message : String(err) });
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function runMemberAction<T extends object>(
  fn: (userId: string) => Promise<T>,
  rateLimit?: { bucket: string; limit: number; windowSeconds: number },
): Promise<ActionResult<T>> {
  try {
    const session = await requireSession();
    if (rateLimit) await checkRateLimit(session.user.id, rateLimit);
    return { ok: true, ...(await fn(session.user.id)) };
  } catch (err) {
    return toResult(err);
  }
}

/** Admin actions re-check the permission on every call — the page gate is not the only guard. */
export async function runAdminAction<T extends object>(fn: (actorId: string) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const session = await requirePermission("partnership:manage");
    return { ok: true, ...(await fn(session.user.id)) };
  } catch (err) {
    return toResult(err);
  }
}
