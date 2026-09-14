import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isSeller, isStaff } from "@/lib/authorization/roles";

// Page-level gate. This is defense-in-depth, not the only check — every
// mutating admin/seller API route also calls requirePermission() itself
// (see src/lib/authorization/guard.ts), since a matcher miss here should
// never be the sole thing standing between a request and a privileged action.
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;

  if (pathname.startsWith("/admin") && !(role && isStaff(role))) {
    return NextResponse.redirect(new URL("/auth/sign-in", req.nextUrl));
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
