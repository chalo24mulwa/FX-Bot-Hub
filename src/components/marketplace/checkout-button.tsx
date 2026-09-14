"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function CheckoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function checkout() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Checkout failed.");
        return;
      }
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      router.push(`/dashboard/orders/${data.orderId}`);
    });
  }

  return (
    <>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <Button className="mt-4 w-full" disabled={isPending} onClick={checkout}>
        {isPending ? "Processing…" : "Checkout"}
      </Button>
    </>
  );
}
