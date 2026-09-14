"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AddToCartButton({ productId, label = "Add to cart" }: { productId: string; label?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);

  function handleClick() {
    startTransition(async () => {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });

      if (res.status === 401) {
        router.push("/auth/sign-in");
        return;
      }
      if (!res.ok) return;

      setAdded(true);
      router.push("/cart");
    });
  }

  return (
    <Button onClick={handleClick} disabled={isPending || added}>
      {isPending ? "Adding…" : added ? "Added" : label}
    </Button>
  );
}
