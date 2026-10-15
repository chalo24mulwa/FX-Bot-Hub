import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isSeller, isStaff } from "@/lib/authorization/roles";
import { can } from "@/lib/authorization/permissions";
import { requiredActionForAdminPath } from "@/lib/admin/route-permissions";

// Page-level gate. This is defense-in-depth, not the only check — every
// mutating admin/seller API route also calls requirePermission() itself
// (see src/lib/authorization/guard.ts), since a matcher miss here should
// never be the sole thing standing between a request and a privileged action.
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user;
  const role = user?.role;

  if (pathname.startsWith("/admin")) {
    // An administrator viewing as a member has that member's role, so /admin is closed to them
    // by design — send them somewhere useful (the banner has the Exit button), not to sign-in.
    if (user?.impersonation) return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
    if (!(role && isStaff(role))) return NextResponse.redirect(new URL("/auth/sign-in", req.nextUrl));

    // Each admin area needs its own capability (finance, payouts, users, …), not just "is staff".
    const needed = requiredActionForAdminPath(pathname);
    if (needed && user && !can(user, needed)) return NextResponse.redirect(new URL("/admin", req.nextUrl));
  }

  if (pathname.startsWith("/seller") && !(role && isSeller(role))) {
    return NextResponse.redirect(new URL("/auth/sign-in", req.nextUrl));
  }

  if (pathname.startsWith("/dashboard") && !role) {
    return NextResponse.redirect(new URL("/auth/sign-in", req.nextUrl));
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/seller/:path*", "/admin/:path*"],
};
