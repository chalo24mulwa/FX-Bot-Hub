import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { evaluateImpersonation, IMPERSONATION_MAX_MINUTES } from "@/lib/admin/rules";
import { requireAdminPage } from "@/features/admin/viewer";
import { ImpersonateForm } from "@/components/admin/user-admin-forms";

export const dynamic = "force-dynamic";

export default async function ImpersonateConfirmPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireAdminPage("user:impersonate");
  const { id } = await params;
  const member = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, bannedAt: true, createdAt: true, _count: { select: { products: true, orders: true } } },
  });
  if (!member) notFound();

  const decision = evaluateImpersonation({ actor: viewer, target: member, alreadyImpersonating: false });
  const label = member.name ?? member.email;

  return (
    <div className="max-w-2xl">
      <Link href={`/admin/users/${member.id}`} className="text-xs text-blue-600 hover:underline">
        ← Back to {label}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">Access account</h1>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">You are about to view the site as</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">{label}</p>
        <p className="text-sm text-slate-600">{member.email}</p>
        <p className="mt-2 text-xs text-slate-500">
          {member.role.replace("_", " ")} · joined {member.createdAt.toLocaleDateString()} · {member._count.products} listing(s), {member._count.orders} order(s)
        </p>
      </div>

      {decision.ok ? (
        <>
          <ul className="mt-5 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>A banner stays on every page with an <strong>Exit impersonation</strong> button.</li>
            <li>The session is recorded under your name and ends automatically after {IMPERSONATION_MAX_MINUTES} minutes.</li>
            <li>You can browse their account and manage their own listings. Payments, payouts, password changes, reviews, community posts and downloads stay blocked — use the dedicated admin tools for those.</li>
            <li>Admin pages are closed while you are in this session; exit to return to your own account.</li>
          </ul>
          <div className="mt-5">
            <ImpersonateForm userId={member.id} memberName={label} />
          </div>
        </>
      ) : (
        <p role="alert" className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {decision.error}
        </p>
      )}
    </div>
  );
}
