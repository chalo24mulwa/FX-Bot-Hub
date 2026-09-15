import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  SUSPENDED: "bg-amber-50 text-amber-700 border-amber-200",
  REVOKED: "bg-red-50 text-red-700 border-red-200",
  EXPIRED: "bg-slate-100 text-slate-500 border-slate-200",
};

export default async function LicensesPage() {
  const session = await auth();
  const licenses = await db.license.findMany({
    where: { userId: session!.user.id },
    orderBy: { issuedAt: "desc" },
    include: { product: { select: { name: true, slug: true } }, licenseActivations: { where: { deactivatedAt: null } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Licenses</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">
        Your license key is what an EA/indicator uses to verify itself against FX BOT Hub — keep it private,
        same as a password. Activation count tracks how many machines/terminals have used it.
      </p>

      {licenses.length === 0 ? (
        <p className="mt-6 text-slate-500">
          No licenses yet. <Link href="/marketplace" className="text-blue-600 hover:underline">Browse the marketplace</Link>.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-slate-100">
          {licenses.map((license) => (
            <li key={license.id} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/marketplace/${license.product.slug}`} className="font-medium text-slate-900 hover:underline">
                  {license.product.name}
                </Link>
                <Badge className={STATUS_STYLES[license.status]}>{license.status}</Badge>
              </div>
              <p className="mt-1 font-mono text-xs text-slate-500">{license.key}</p>
              <p className="mt-1 text-xs text-slate-400">
                {license.licenseActivations.length}/{license.maxActivations} activations
                {license.expiresAt && ` · expires ${license.expiresAt.toLocaleDateString()}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
