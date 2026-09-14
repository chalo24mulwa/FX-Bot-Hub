"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function RemoveFromCartButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await fetch("/api/cart", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId }),
          });
          router.refresh();
        })
      }
      className="text-sm text-slate-400 hover:text-red-600 disabled:opacity-50"
    >
      Remove
    </button>
  );
}
