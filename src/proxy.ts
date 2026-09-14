export { auth as proxy } from "@/lib/auth";

// Extend `matcher` as protected routes are added (e.g. /vendor).
export const config = {
  matcher: ["/dashboard/:path*", "/vendor/:path*"],
};
