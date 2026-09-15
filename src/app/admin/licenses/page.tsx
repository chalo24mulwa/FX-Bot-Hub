import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { LicenseActions } from "@/components/admin/license-actions";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  SUSPENDED: "bg-amber-50 text-amber-700 border-amber-200",
  REVOKED: "bg-red-50 text-red-700 border-red-200",
  EXPIRED: "bg-slate-100 text-slate-500 border-slate-200",
};

export default async function AdminLicensesPage() {
  const licenses = await db.license.findMany({
    orderBy: { issuedAt: "desc" },
    take: 100,
    include: {
      user: { select: { name: true, email: true } },
      product: { select: { name: true, slug: true } },
      licenseActivations: { where: { deactivatedAt: null } },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Licenses</h1>
      <p className="mt-1 text-sm text-slate-500">
        Suspend is reversible (a temporary hold); revoke is permanent. Both immediately affect the download
        route&apos;s entitlement check and the /api/licenses/verify response an EA sees.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-3">Customer</th>
              <th className="py-2 pr-3">Product</th>
              <th className="py-2 pr-3">Key</th>
              <th className="py-2 pr-3">Activations</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {licenses.map((license) => (
              <tr key={license.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 text-slate-600">{license.user.name ?? license.user.email}</td>
                <td className="py-2 pr-3 font-medium text-slate-900">{license.product.name}</td>
                <td className="py-2 pr-3 font-mono text-xs text-slate-500">{license.key.slice(0, 12)}…</td>
                <td className="py-2 pr-3 text-slate-500">
                  {license.licenseActivations.length}/{license.maxActivations}
                </td>
                <td className="py-2 pr-3">
                  <Badge className={STATUS_STYLES[license.status]}>{license.status}</Badge>
                </td>
                <td className="py-2 pr-3">
                  <LicenseActions licenseId={license.id} status={license.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {licenses.length === 0 && <p className="py-8 text-center text-slate-500">No licenses yet.</p>}
      </div>
    </div>
  );
}
