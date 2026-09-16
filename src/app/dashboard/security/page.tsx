import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const session = await auth();
  const user = await db.user.findUnique({ where: { id: session!.user.id }, select: { password: true } });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Security</h1>
      <p className="mt-1 text-sm text-slate-500">Manage your account password.</p>

      <div className="mt-6 max-w-md">
        {user?.password ? (
          <ChangePasswordForm />
        ) : (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            You sign in with Google, so there&apos;s no password on this account to change.
          </p>
        )}
      </div>
    </div>
  );
}
