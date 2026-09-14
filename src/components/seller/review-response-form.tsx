"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { respondToReviewAction } from "@/features/seller/actions";

export function ReviewResponseForm({ reviewId, existing }: { reviewId: string; existing?: string | null }) {
  const [value, setValue] = useState(existing ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div className="mt-2 flex max-w-md flex-col gap-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        placeholder="Respond to this review…"
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        disabled={isPending || value.trim().length === 0}
        onClick={() =>
          startTransition(async () => {
            await respondToReviewAction(reviewId, value.trim());
            setSaved(true);
          })
        }
      >
        {isPending ? "Saving…" : saved ? "Saved" : "Respond"}
      </Button>
    </div>
  );
}
