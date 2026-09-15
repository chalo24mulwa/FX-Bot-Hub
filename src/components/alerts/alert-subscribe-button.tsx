"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { subscribeToAlertAction, unsubscribeFromAlertAction } from "@/features/alerts/actions";
import type { AlertType } from "@prisma/client";
import { Button } from "@/components/ui/button";

export function AlertSubscribeButton({
  type,
  targetId,
  initialSubscribed,
  label,
}: {
  type: AlertType;
  targetId: string;
  initialSubscribed: boolean;
  label: string;
}) {
  const router = useRouter();
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      try {
        if (subscribed) {
          await unsubscribeFromAlertAction(type, targetId);
        } else {
          await subscribeToAlertAction(type, targetId);
        }
        setSubscribed(!subscribed);
      } catch {
        router.push("/auth/sign-in");
      }
    });
  }

  return (
    <Button type="button" variant={subscribed ? "outline" : "default"} size="sm" disabled={isPending} onClick={toggle}>
      {isPending ? "…" : subscribed ? `✓ ${label}` : label}
    </Button>
  );
}
