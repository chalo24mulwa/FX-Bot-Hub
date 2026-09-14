"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateMarketplaceSettingsAction } from "@/features/admin/actions";
import type { RankingWeights } from "@/features/admin/settings-service";

const WEIGHT_LABELS: { key: keyof RankingWeights; label: string }[] = [
  { key: "sales", label: "Sales" },
  { key: "downloads", label: "Downloads" },
  { key: "reviews", label: "Review count" },
  { key: "rating", label: "Average rating" },
  { key: "recency", label: "Recency" },
  { key: "favorites", label: "Favorites" },
];

export function SettingsForm({
  commissionPercent,
  rankingWeights,
}: {
  commissionPercent: number;
  rankingWeights: RankingWeights;
}) {
  const [commission, setCommission] = useState(commissionPercent);
  const [weights, setWeights] = useState(rankingWeights);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    startTransition(async () => {
      await updateMarketplaceSettingsAction({ commissionPercent: commission, rankingWeights: weights });
      setSaved(true);
    });
  }

  return (
    <div className="flex max-w-md flex-col gap-6">
      <label className="flex flex-col gap-1 text-sm">
        Commission (%)
        <Input
          type="number"
          min={0}
          max={100}
          value={commission}
          onChange={(e) => {
            setCommission(Number(e.target.value));
            setSaved(false);
          }}
        />
      </label>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-900">Ranking weights</p>
        <p className="mb-3 text-xs text-slate-500">
          Controls the &ldquo;Popular&rdquo; sort — higher weight means that factor matters more relative to the others.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {WEIGHT_LABELS.map(({ key, label }) => (
            <label key={key} className="flex flex-col gap-1 text-sm">
              {label}
              <Input
                type="number"
                min={0}
                step={0.5}
                value={weights[key]}
                onChange={(e) => {
                  setWeights((w) => ({ ...w, [key]: Number(e.target.value) }));
                  setSaved(false);
                }}
              />
            </label>
          ))}
        </div>
      </div>

      <Button type="button" onClick={save} disabled={isPending} className="self-start">
        {isPending ? "Saving…" : saved ? "Saved" : "Save settings"}
      </Button>
    </div>
  );
}
