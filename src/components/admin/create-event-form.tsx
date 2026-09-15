"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createEconomicEventAction } from "@/features/admin/calendar-actions";
import type { EconomicEventInput } from "@/features/admin/calendar-actions";

const IMPACTS = ["HIGH", "MEDIUM", "LOW", "HOLIDAY", "OTHER"];
const CATEGORIES = ["CENTRAL_BANK", "EMPLOYMENT", "INFLATION", "GDP", "MANUFACTURING", "RETAIL", "HOUSING", "CONSUMER", "POLITICS", "OTHER"];

export function CreateEventForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const input: EconomicEventInput = {
      country: String(formData.get("country")),
      currency: String(formData.get("currency")).toUpperCase(),
      title: String(formData.get("title")),
      impact: String(formData.get("impact")) as EconomicEventInput["impact"],
      category: String(formData.get("category")) as EconomicEventInput["category"],
      eventTime: String(formData.get("eventTime")),
      forecast: String(formData.get("forecast") ?? "") || undefined,
      previous: String(formData.get("previous") ?? "") || undefined,
      description: String(formData.get("description") ?? "") || undefined,
    };

    startTransition(async () => {
      try {
        await createEconomicEventAction(input);
        e.currentTarget.reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create event.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid max-w-2xl grid-cols-2 gap-3 rounded-md border border-slate-200 p-4">
      {error && <p className="col-span-2 text-xs text-red-600">{error}</p>}
      <Input name="title" placeholder="Title" required />
      <Input name="currency" placeholder="Currency (USD)" required maxLength={3} />
      <Input name="country" placeholder="Country" required />
      <Input name="eventTime" type="datetime-local" required />
      <select name="impact" defaultValue="MEDIUM" className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm">
        {IMPACTS.map((i) => (
          <option key={i} value={i}>
            {i}
          </option>
        ))}
      </select>
      <select name="category" defaultValue="OTHER" className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm">
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c.replace("_", " ")}
          </option>
        ))}
      </select>
      <Input name="forecast" placeholder="Forecast (optional)" />
      <Input name="previous" placeholder="Previous (optional)" />
      <textarea name="description" placeholder="Description (optional)" rows={2} className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm" />
      <Button type="submit" disabled={isPending} className="col-span-2">
        {isPending ? "Creating…" : "Create event"}
      </Button>
    </form>
  );
}
