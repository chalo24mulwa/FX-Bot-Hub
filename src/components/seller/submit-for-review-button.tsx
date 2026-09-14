"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function SubmitForReviewButton({ action }: { action: () => Promise<void> }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      onClick={() => startTransition(() => action())}
    >
      {isPending ? "Submitting…" : "Submit for review"}
    </Button>
  );
}
