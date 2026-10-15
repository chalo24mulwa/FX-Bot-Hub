import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { can, type Action } from "./permissions";
import { CsrfError } from "@/lib/security/csrf";
import { RateLimitError } from "@/lib/security/rate-limit";
import { recordAuditLog } from "@/repositories/audit-log-repository";

export class AuthorizationError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

export interface GuardOptions {
  /**
   * While an administrator is viewing as a member, every guarded action is
   * refused — "view as user" is read-only by default, so a payment, payout,
   * password change, review or post can never be made in someone else's name by
   * accident, and a new action added later is safe without anyone remembering to
   * block it. A caller opts in only for support tasks that genuinely belong in
   * the member's own context (managing their own listing). Those calls are
   * written to the audit log with the impersonation session id.
   */
  allowImpersonation?: boolean;
}

/** Use in route handlers / server actions. Throws AuthorizationError, which
 * callers turn into a 401/403 JSON response (see `guardResponse` below). */
export async function requireSession(options: GuardOptions = {}) {
  const session = await auth();
  if (!session?.user) throw new AuthorizationError("Authentication required.", 401);

  const impersonation = session.user.impersonation;
  if (impersonation) {
    if (!options.allowImpersonation) {
      throw new AuthorizationError("That isn't available while you're viewing as another member. Exit the session first.", 403);
    }
    // Fail closed: if the audit record can't be written, the action doesn't happen.
    await recordImpersonatedAction(session.user.id, impersonation);
  }
  return session;
}

export async function requirePermission(action: Action, options: GuardOptions = {}) {
  const session = await requireSession(options);
  if (!can(session.user, action)) {
    throw new AuthorizationError(`Missing permission: ${action}`, 403);
  }
  return session;
}

async function recordImpersonatedAction(targetUserId: string, impersonation: { sessionId: string; adminId: string }) {
  let path = "unknown";
  try {
    const h = await headers();
    const raw = h.get("next-url") ?? h.get("referer") ?? "";
    // Path only — never the query string, which can carry tokens.
    path = raw ? new URL(raw, "http://localhost").pathname : "unknown";
  } catch {
    // headers() is unavailable outside a request; the audit row is still written.
  }
  await recordAuditLog({
    actorId: impersonation.adminId,
    action: "impersonation.action",
    entityType: "User",
    entityId: targetUserId,
    impersonationSessionId: impersonation.sessionId,
    metadata: { path },
  });
}

/** Wrap a route handler body in this to turn AuthorizationError/CsrfError/
 * RateLimitError into a proper JSON response instead of a 500. */
export async function withAuthorization<T>(fn: () => Promise<T>): Promise<T | NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AuthorizationError || err instanceof CsrfError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: err.message },
        { status: 429, headers: { "Retry-After": String(err.retryAfterSeconds) } }
      );
    }
    throw err;
  }
}
