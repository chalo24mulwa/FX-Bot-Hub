"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { requestPayoutAction } from "@/features/payouts/actions";

export function RequestPayoutButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        type="button"
        disabled={disabled || isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              await requestPayoutAction();
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not request payout.");
            }
          })
        }
      >
        {isPending ? "Requesting…" : "Request payout"}
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
