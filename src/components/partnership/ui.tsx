import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/partnership/rules";

// Small presentational pieces shared by the Partner dashboard and admin pages.

const TONES = {
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  red: "border-red-200 bg-red-50 text-red-700",
  slate: "border-slate-200 bg-slate-50 text-slate-600",
  sky: "border-sky-200 bg-sky-50 text-sky-800",
  violet: "border-violet-200 bg-violet-50 text-violet-800",
} as const;

const STATUS: Record<string, { label: string; tone: keyof typeof TONES }> = {
  NOT_APPLIED: { label: "Not applied", tone: "slate" },
  PENDING: { label: "Pending", tone: "amber" },
  APPROVED: { label: "Approved", tone: "emerald" },
  REJECTED: { label: "Rejected", tone: "red" },
  SUSPENDED: { label: "Suspended", tone: "red" },
  PAID: { label: "Paid", tone: "violet" },
  REVERSED: { label: "Reversed", tone: "slate" },
  REQUESTED: { label: "Requested", tone: "sky" },
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const s = STATUS[status] ?? { label: status, tone: "slate" as const };
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", TONES[s.tone], className)}>{s.label}</span>;
}

export const TIER_LABEL: Record<string, string> = { PARTNER: "Partner", MASTER_PARTNER: "Master Partner" };
export const SOURCE_LABEL: Record<string, string> = { REGISTRATION: "Referred account", REFERRAL_LINK: "Referral link" };

export function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1.5 break-words text-xl font-semibold text-slate-900">{value}</div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** One amount per currency, or a dash when there's nothing. */
export function MoneyList({ items, field }: { items: { currency: string }[]; field: string }) {
  const rows = items
    .map((i) => ({ currency: i.currency, cents: (i as unknown as Record<string, number>)[field] ?? 0 }))
    .filter((r) => r.cents !== 0);
  if (rows.length === 0) return <span className="text-slate-400">{formatMoney(0, items[0]?.currency ?? "USD")}</span>;
  return (
    <span className="flex flex-col">
      {rows.map((r) => (
        <span key={r.currency}>{formatMoney(r.cents, r.currency)}</span>
      ))}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="font-medium text-slate-900">{title}</p>
      {children && <div className="mt-2 text-sm text-slate-600">{children}</div>}
    </div>
  );
}

export function Pager({ page, total, pageSize, href }: { page: number; total: number; pageSize: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="mt-6 flex items-center justify-center gap-3 text-sm">
      {page > 1 && (
        <Link href={href(page - 1)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50">
          Previous
        </Link>
      )}
      <span className="text-slate-500">
        Page {page} of {pages}
      </span>
      {page < pages && (
        <Link href={href(page + 1)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50">
          Next
        </Link>
      )}
    </nav>
  );
}

export function parsePage(raw: string | string[] | undefined): number {
  const n = Number.parseInt(Array.isArray(raw) ? raw[0] : (raw ?? ""), 10);
  return Number.isFinite(n) && n > 1 ? Math.min(n, 10_000) : 1;
}

export function firstParam(raw: string | string[] | undefined): string {
  return (Array.isArray(raw) ? raw[0] : raw) ?? "";
}

export const fmtDate = (d: Date | null | undefined) =>
  d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
