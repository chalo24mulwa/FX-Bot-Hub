import Link from "next/link";
import { listProviders } from "@/features/signals/provider-service";
import { Badge } from "@/components/ui/badge";
import { ProviderVerifyToggle } from "@/components/admin/provider-verify-toggle";

export const dynamic = "force-dynamic";

export default async function AdminSignalProvidersPage() {
  const { items } = await listProviders(1, 50);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Signal providers</h1>
      <p className="mt-1 text-sm text-slate-500">
        Verified is an admin-controlled badge — it never derives from a provider&apos;s own self-reported stats.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-3">Provider</th>
              <th className="py-2 pr-3">Pricing</th>
              <th className="py-2 pr-3">Signals</th>
              <th className="py-2 pr-3">Subscribers</th>
              <th className="py-2 pr-3">Verified</th>
              <th className="py-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((provider) => (
              <tr key={provider.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium">
                  <Link href={`/signals/provider/${provider.slug}`} className="hover:underline">
                    {provider.displayName}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-slate-500">{provider.pricingType}</td>
                <td className="py-2 pr-3 text-slate-500">{provider._count.signals}</td>
                <td className="py-2 pr-3 text-slate-500">{provider._count.subscriptions}</td>
                <td className="py-2 pr-3">
                  {provider.verified ? <Badge className="border-blue-200 bg-blue-50 text-blue-700">Verified</Badge> : "—"}
                </td>
                <td className="py-2 pr-3">
                  <ProviderVerifyToggle id={provider.id} verified={provider.verified} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="py-8 text-center text-slate-500">No signal providers yet.</p>}
      </div>
    </div>
  );
}
