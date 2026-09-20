import Link from "next/link";
import { adminListHistory } from "@/features/community/queries";

export const dynamic = "force-dynamic";

function describe(meta: unknown): string {
  if (!meta || typeof meta !== "object") return "";
  const m = meta as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof m.title === "string") parts.push(`“${m.title}”`);
  if (typeof m.reason === "string" && m.reason) parts.push(`Reason: ${m.reason}`);
  if (typeof m.note === "string" && m.note) parts.push(`Note: ${m.note}`);
  if (typeof m.endsAt === "string") parts.push(`Until ${m.endsAt.slice(0, 16).replace("T", " ")} UTC`);
  if (m.endsAt === null) parts.push("Permanent");
  if (typeof m.name === "string") parts.push(m.name);
  return parts.join(" · ");
}

export default async function AdminCommunityHistory({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? "1", 10) || 1);
  const { items, total, pageSize } = await adminListHistory(page);
  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">
        Every moderation action on posts, comments, reports, categories and members — append-only. {total} entr{total === 1 ? "y" : "ies"}.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-3">When</th>
              <th className="py-2 pr-3">Moderator</th>
              <th className="py-2 pr-3">Action</th>
              <th className="py-2 pr-3">Target</th>
              <th className="py-2 pr-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 align-top">
                <td className="whitespace-nowrap py-2 pr-3 text-slate-500">{row.createdAt.toLocaleString()}</td>
                <td className="py-2 pr-3 text-slate-700">{row.actor?.name ?? row.actor?.email ?? "system"}</td>
                <td className="py-2 pr-3 font-mono text-xs text-slate-800">{row.action}</td>
                <td className="py-2 pr-3 text-xs text-slate-500">
                  {row.entityType === "CommunityPost" && row.entityId ? (
                    <Link href={`/community/post/${row.entityId}`} className="text-blue-600 hover:underline">
                      post
                    </Link>
                  ) : row.entityType === "CommunityUser" && row.entityId ? (
                    <Link href={`/admin/community/members?history=${row.entityId}`} className="text-blue-600 hover:underline">
                      member
                    </Link>
                  ) : (
                    row.entityType.replace("Community", "").toLowerCase()
                  )}
                </td>
                <td className="py-2 pr-3 text-slate-600">{describe(row.metadata)}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
                  No moderation activity yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {total > pageSize && (
        <div className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={`/admin/community/history?page=${page - 1}`} className="text-blue-600 hover:underline">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          {page * pageSize < total ? (
            <Link href={`/admin/community/history?page=${page + 1}`} className="text-blue-600 hover:underline">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
