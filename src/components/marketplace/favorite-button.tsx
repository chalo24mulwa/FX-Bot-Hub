"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  productId,
  initialFavorited,
  className,
}: {
  productId: string;
  initialFavorited: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    startTransition(async () => {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });

      if (res.status === 401) {
        router.push("/auth/sign-in");
        return;
      }
      if (!res.ok) return;

      const data = (await res.json()) as { favorited: boolean };
      setFavorited(data.favorited);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-pressed={favorited}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-lg shadow transition-colors hover:bg-white disabled:opacity-60",
        favorited ? "text-red-500" : "text-slate-400",
        className
      )}
    >
      {favorited ? "♥" : "♡"}
    </button>
  );
}
