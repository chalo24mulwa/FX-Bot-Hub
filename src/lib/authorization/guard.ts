import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can, type Action } from "./permissions";
import { CsrfError } from "@/lib/security/csrf";
import { RateLimitError } from "@/lib/security/rate-limit";

export class AuthorizationError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

/** Use in route handlers / server actions. Throws AuthorizationError, which
 * callers turn into a 401/403 JSON response (see `guardResponse` below). */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new AuthorizationError("Authentication required.", 401);
  return session;
}

export async function requirePermission(action: Action) {
  const session = await requireSession();
  if (!can(session.user.role, action)) {
    throw new AuthorizationError(`Missing permission: ${action}`, 403);
  }
  return session;
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
