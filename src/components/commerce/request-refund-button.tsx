"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { requestRefundAction } from "@/features/refunds/actions";

export function RequestRefundButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  if (requested) {
    return <p className="text-sm text-slate-500">Refund requested — an admin will review it.</p>;
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Request refund
      </Button>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        Reason (optional)
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </label>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              try {
                await requestRefundAction(orderId, reason || undefined);
                setRequested(true);
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not request refund.");
              }
            })
          }
        >
          {isPending ? "Submitting…" : "Submit request"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
