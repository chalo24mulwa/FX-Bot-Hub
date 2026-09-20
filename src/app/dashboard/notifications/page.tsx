import { auth } from "@/lib/auth";
import { listNotifications } from "@/repositories/notification-repository";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();
  const { items } = await listNotifications(session!.user.id, 1, 50);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
      {items.length === 0 ? (
        <p className="mt-4 text-slate-500">No notifications yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {items.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-4 py-3">
              <div>
                {n.link ? (
                  <Link href={n.link} className="font-medium text-slate-900 hover:underline">
                    {n.title}
                  </Link>
                ) : (
                  <p className="font-medium text-slate-900">{n.title}</p>
                )}
                {n.body && <p className="text-sm text-slate-500">{n.body}</p>}
                <p className="mt-1 text-xs text-slate-400">{n.createdAt.toLocaleString()}</p>
              </div>
              {!n.read && <Badge>New</Badge>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
