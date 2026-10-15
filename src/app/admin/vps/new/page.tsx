import Link from "next/link";
import { requireAdminPage } from "@/features/admin/viewer";
import { VpsForm } from "@/components/admin/vps-form";

export const dynamic = "force-dynamic";

export default async function NewVpsPage() {
  await requireAdminPage("vps:manage");
  return (
    <div>
      <Link href="/admin/vps" className="text-xs text-blue-600 hover:underline">← All providers</Link>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">Add a VPS provider</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        The provider is saved as a draft. You can preview it, then publish it from its page. Don&apos;t enter prices, specifications, locations, latency or ratings you haven&apos;t verified — blanks are shown as &ldquo;Not provided&rdquo;.
      </p>
      <div className="mt-6">
        <VpsForm />
      </div>
    </div>
  );
}
