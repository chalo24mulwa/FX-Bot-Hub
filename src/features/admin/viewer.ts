import { redirect } from "next/navigation";
import type { AdminRole, UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, type Action } from "@/lib/authorization/permissions";
import { isStaff } from "@/lib/authorization/roles";
import { loadAdminRoles } from "./impersonation-token";

export interface AdminViewer {
  id: string;
  role: UserRole;
  adminRoles: AdminRole[];
  bannedAt: Date | null;
  mustChangePassword: boolean;
}

/**
 * Page helper: the signed-in administrator, re-read from the database, who must
 * hold `action`. The proxy and layout already gate /admin; this is the page-level
 * check so a page never renders data its viewer's role may not see.
 */
export async function requireAdminPage(action: Action): Promise<AdminViewer> {
  const session = await auth();
  if (!session?.user || session.user.impersonation || !isStaff(session.user.role)) redirect("/auth/sign-in");
  const row = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true, bannedAt: true, mustChangePassword: true } });
  if (!row || row.bannedAt || !isStaff(row.role)) redirect("/auth/sign-in");
  const adminRoles = await loadAdminRoles(row.id, row.role);
  const viewer: AdminViewer = { ...row, adminRoles };
  if (!can(viewer, action)) redirect("/admin");
  return viewer;
}
