import { cn } from "@/lib/utils";

const GRADIENTS = [
  "from-violet-500 to-indigo-600",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-600",
  "from-sky-500 to-blue-600",
  "from-rose-500 to-pink-600",
  "from-fuchsia-500 to-purple-600",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const SIZES = { xs: "h-6 w-6 text-[10px]", sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-20 w-20 text-2xl" } as const;

export function UserAvatar({
  user,
  size = "sm",
  className,
}: {
  user: { id: string; displayName: string; avatarUrl: string | null };
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const initials =
    user.displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- third-party avatar hosts (e.g. Google) vary; not worth the optimizer allowlist
      <img
        src={user.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className={cn("shrink-0 rounded-full bg-slate-200 object-cover ring-2 ring-white/70", SIZES[size], className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ring-2 ring-white/70",
        GRADIENTS[hash(user.id) % GRADIENTS.length],
        SIZES[size],
        className
      )}
    >
      {initials}
    </span>
  );
}
