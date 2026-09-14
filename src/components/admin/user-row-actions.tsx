"use client";

import { useTransition } from "react";
import type { UserRole } from "@prisma/client";
import { changeUserRoleAction, setUserBannedAction } from "@/features/admin/actions";

const ROLES: UserRole[] = ["USER", "SELLER", "AUTHOR", "MODERATOR", "ADMIN", "SUPER_ADMIN"];

export function UserRowActions({
  userId,
  role,
  banned,
}: {
  userId: string;
  role: UserRole;
  banned: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <select
        defaultValue={role}
        disabled={isPending}
        onChange={(e) => startTransition(() => changeUserRoleAction(userId, e.target.value as UserRole))}
        className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button
        disabled={isPending}
        onClick={() => startTransition(() => setUserBannedAction(userId, !banned))}
        className={`rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
          banned ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-red-600 text-white hover:bg-red-700"
        }`}
      >
        {banned ? "Unban" : "Ban"}
      </button>
    </div>
  );
}
