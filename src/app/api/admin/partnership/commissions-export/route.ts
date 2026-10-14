import { NextRequest, NextResponse } from "next/server";
import { requirePermission, withAuthorization } from "@/lib/authorization";
import { exportCommissionRows } from "@/features/partnership/queries";
import { recordAuditLog } from "@/repositories/audit-log-repository";

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
  // Quote every cell and neutralise spreadsheet formulas.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** Admin-only CSV of commission records in a date range (GET — read-only, no state change beyond the audit entry). */
export async function GET(request: NextRequest) {
  return withAuthorization(async () => {
    const session = await requirePermission("partnership:manage");
    const sp = request.nextUrl.searchParams;
    const parse = (v: string | null, fallback: Date) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : fallback);
    const to = new Date(parse(sp.get("to"), new Date()).getTime() + 86_400_000 - 1);
    const from = parse(sp.get("from"), new Date(Date.now() - 30 * 86_400_000));
    const rows = await exportCommissionRows(from, to);

    const header = ["commission_id", "created_at", "beneficiary_email", "beneficiary_code", "type", "beneficiary_tier", "order_id", "order_item_id", "rate_bps", "basis_cents", "amount_cents", "currency", "status", "hold_until", "approved_at", "paid_at", "payout_id", "reversed_at", "reason"];
    const lines = rows.map((r) =>
      [r.id, r.createdAt, r.beneficiary.user.email, r.beneficiary.referralCode, r.type, r.beneficiaryTier, r.orderId, r.orderItemId, r.rateBps, r.basisCents, r.amountCents, r.currency, r.status, r.holdUntil, r.approvedAt, r.paidAt, r.payoutId, r.reversedAt, r.statusReason]
        .map(csvCell)
        .join(","),
    );
    await recordAuditLog({ actorId: session.user.id, action: "partnership.commission.export", entityType: "PartnerCommission", metadata: { from: from.toISOString(), to: to.toISOString(), rows: rows.length } });
    return new NextResponse([header.join(","), ...lines].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="partner-commissions-${from.toISOString().slice(0, 10)}-to-${to.toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
