"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateEconomicEventAction } from "@/features/admin/calendar-actions";
import type { EconomicEventInput } from "@/features/admin/calendar-actions";
import type { EconomicEvent } from "@prisma/client";

const IMPACTS = ["HIGH", "MEDIUM", "LOW", "HOLIDAY", "OTHER"];

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Lets an admin correct erroneous data on any event — including ones a
 * sync wrote (source !== "manual") — without touching the row's
 * externalId/source, so a later re-sync still matches and updates it
 * normally (see CLAUDE.md's dedup-by-externalId note). Spec section 15:
 * "Correct erroneous data where permitted." */
export function EditEventButton({ event }: { event: Pick<EconomicEvent, "id" | "title" | "currency" | "eventTime" | "impact" | "forecast" | "previous" | "actual"> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
        Edit
      </button>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const input: Partial<EconomicEventInput> = {
      title: String(formData.get("title")),
      currency: String(formData.get("currency")).toUpperCase(),
      eventTime: String(formData.get("eventTime")),
      impact: String(formData.get("impact")) as EconomicEventInput["impact"],
      actual: String(formData.get("actual") ?? "") || undefined,
      forecast: String(formData.get("forecast") ?? "") || undefined,
      previous: String(formData.get("previous") ?? "") || undefined,
    };

    startTransition(async () => {
      try {
        await updateEconomicEventAction(event.id, input);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update event.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-md bg-white p-4 shadow-lg">
        <p className="text-sm font-semibold text-slate-900">Edit event</p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Input name="title" defaultValue={event.title} className="col-span-2" required />
          <Input name="currency" defaultValue={event.currency} maxLength={3} required />
          <Input name="eventTime" type="datetime-local" defaultValue={toLocalInputValue(event.eventTime)} required />
          <select name="impact" defaultValue={event.impact} className="col-span-2 h-10 rounded-md border border-slate-300 bg-white px-2 text-sm">
            {IMPACTS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <Input name="actual" defaultValue={event.actual ?? ""} placeholder="Actual" />
          <Input name="forecast" defaultValue={event.forecast ?? ""} placeholder="Forecast" />
          <Input name="previous" defaultValue={event.previous ?? ""} placeholder="Previous" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </form>
  );
}
