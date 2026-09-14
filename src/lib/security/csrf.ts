import { NextRequest } from "next/server";

export class CsrfError extends Error {
  status = 403;
  constructor() {
    super("Cross-origin request rejected.");
  }
}

/**
 * Pragmatic CSRF defense for our own JSON API routes (NextAuth's own
 * endpoints already carry its own CSRF token — this covers the rest).
 * Since these are same-site cookie-authenticated requests, a same-origin
 * check on Origin/Referer against Host is sufficient: a cross-site page
 * cannot forge that header, and same-site fetches always send it in
 * modern browsers. Use in every state-changing route handler.
 */
export function assertSameOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");
  if (!origin) {
    // Same-origin navigations/fetches always send Origin for state-changing
    // methods in modern browsers; a missing header means a non-browser
    // client or an older browser — reject rather than assume safety.
    throw new CsrfError();
  }

  const host = request.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new CsrfError();
  }

  if (originHost !== host) {
    throw new CsrfError();
  }
}
