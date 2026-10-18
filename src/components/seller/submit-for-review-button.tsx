"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

/**
 * Submit for review. The button reacts on the click itself ("Submitted ✓" straight away) instead of waiting for the server
 * round trip and the page refresh that follows it; if the server refuses, it goes back to normal and says why.
 */
export function SubmitForReviewButton({ action }: { action: () => Promise<void> }) {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        disabled={isPending || submitted}
        onClick={() => {
          setError(null);
          setSubmitted(true);
          startTransition(async () => {
            try {
              await action();
            } catch (err) {
              setSubmitted(false);
              setError(err instanceof Error ? err.message : "Could not submit for review. Please try again.");
            }
          });
        }}
      >
        {submitted ? "Submitted ✓" : "Submit for review"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
