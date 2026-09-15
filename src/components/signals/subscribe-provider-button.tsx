"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { subscribeToProviderAction } from "@/features/signals/actions";
import { Button } from "@/components/ui/button";

export function SubscribeProviderButton({ providerId, label }: { providerId: string; label: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "active" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function subscribe() {
    startTransition(async () => {
      try {
        const result = await subscribeToProviderAction(providerId);
        if (result.redirectUrl) {
          window.location.href = result.redirectUrl;
          return;
        }
        setStatus("active");
        router.refresh();
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Could not subscribe.");
      }
    });
  }

  if (status === "active") {
    return <p className="text-sm font-medium text-emerald-700">✓ Subscribed</p>;
  }

  return (
    <div>
      <Button type="button" disabled={isPending} onClick={subscribe}>
        {isPending ? "…" : label}
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
