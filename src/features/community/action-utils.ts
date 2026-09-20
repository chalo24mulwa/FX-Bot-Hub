import { ZodError } from "zod";
import { AuthorizationError, requireSession } from "@/lib/authorization";
import { checkRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { logger } from "@/lib/logger";
import { CommunityError, type Actor, type ActionResult } from "./core";

// Server actions never throw expected failures at the client (Next would
// surface them as an opaque production error). They resolve to
// `{ ok: false, error }`, and anything unexpected is logged server-side and
// shown as a generic message.

export async function runAction<T extends object>(
  fn: (actor: Actor) => Promise<T>,
  options: { rateLimit?: { bucket: string; limit: number; windowSeconds: number } } = {}
): Promise<ActionResult<T>> {
  try {
    const session = await requireSession();
    const actor: Actor = { id: session.user.id, role: session.user.role };
    // Redis-backed (fails open when Redis is down); the service layer also
    // enforces database-backed limits that don't depend on Redis.
    if (options.rateLimit) await checkRateLimit(actor.id, options.rateLimit);
    return { ok: true, ...(await fn(actor)) };
  } catch (err) {
    if (err instanceof CommunityError) return { ok: false, error: err.message };
    if (err instanceof AuthorizationError) return { ok: false, error: err.status === 401 ? "Please sign in to do that." : "You don't have permission to do that." };
    if (err instanceof RateLimitError) return { ok: false, error: "You're doing that too quickly. Please wait a moment." };
    if (err instanceof ZodError) return { ok: false, error: "Something in that request isn't valid. Please check it and try again." };
    logger.error("community action failed", { error: err instanceof Error ? err.message : String(err) });
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
