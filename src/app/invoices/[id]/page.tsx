import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isStaff } from "@/lib/authorization/roles";
import { getInvoice } from "@/repositories/invoice-repository";
import { formatPriceCents } from "@/lib/utils";
import { PrintButton } from "@/components/commerce/print-button";

export const dynamic = "force-dynamic";

interface InvoicePageProps {
  params: Promise<{ id: string }>;
}

// A plain, print-friendly HTML page rather than a generated PDF file — the
// browser's own "Print > Save as PDF" produces a real, downloadable PDF
// with zero new dependencies (no PDF-generation library was already in
// this project). See CLAUDE.md's Phase 4 section for the reasoning.
export default async function InvoicePage({ params }: InvoicePageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/auth/sign-in?callbackUrl=/invoices/${id}`);

  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  const isParty = session.user.id === invoice.buyerId || session.user.id === invoice.sellerId;
  if (!isParty && !isStaff(session.user.role)) notFound();

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-12 print:py-0">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Invoice</h1>
          <p className="mt-1 text-sm text-slate-500">{invoice.invoiceNumber}</p>
        </div>
        <PrintButton />
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-slate-400">Date</dt>
          <dd className="text-slate-900">{invoice.createdAt.toLocaleDateString()}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Status</dt>
          <dd className="text-slate-900">{invoice.status}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Customer</dt>
          <dd className="text-slate-900">{invoice.buyer.name ?? invoice.buyer.email}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Seller</dt>
          <dd className="text-slate-900">{invoice.seller.sellerProfile?.displayName ?? invoice.seller.name ?? invoice.seller.email}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Payment reference</dt>
          <dd className="text-slate-900">{invoice.paymentReference ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Order</dt>
          <dd className="text-slate-900">#{invoice.orderId.slice(0, 8)}</dd>
        </div>
      </dl>

      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2">Product</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100">
            <td className="py-3 text-slate-900">{invoice.product.name}</td>
            <td className="py-3 text-right text-slate-900">{formatPriceCents(invoice.amountCents, invoice.currency)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td className="pt-3 text-right font-semibold text-slate-900">Total</td>
            <td className="pt-3 text-right font-semibold text-slate-900">
              {formatPriceCents(invoice.amountCents, invoice.currency)}
            </td>
          </tr>
        </tfoot>
      </table>

      <p className="mt-10 text-xs text-slate-400">FX Bot Market — this invoice is generated automatically at time of sale.</p>
    </main>
  );
}
