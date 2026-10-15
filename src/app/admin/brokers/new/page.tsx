import Link from "next/link";
import { requireAdminPage } from "@/features/admin/viewer";
import { BrokerForm } from "@/components/admin/broker-form";

export const dynamic = "force-dynamic";

export default async function NewBrokerPage() {
  await requireAdminPage("broker:manage");
  return (
    <div>
      <Link href="/admin/brokers" className="text-xs text-blue-600 hover:underline">← All brokers</Link>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">Add a broker</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        The broker is saved as a draft. You can preview it, then publish it from its page. Don&apos;t enter regulation, spreads, deposits or ratings you haven&apos;t verified — blanks are shown as &ldquo;Not provided&rdquo;.
      </p>
      <div className="mt-6">
        <BrokerForm />
      </div>
    </div>
  );
}
