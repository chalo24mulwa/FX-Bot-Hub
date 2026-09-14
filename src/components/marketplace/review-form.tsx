"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReviewForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/products/${productId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, title: title || undefined, body: body || undefined }),
    });

    setSubmitting(false);
    if (res.status === 401) {
      router.push("/auth/sign-in");
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not submit your review.");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-2 rounded-md border border-slate-200 p-4">
      <p className="text-sm font-medium text-slate-900">Write a review</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            className={star <= rating ? "text-amber-500" : "text-slate-300"}
          >
            ★
          </button>
        ))}
      </div>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" maxLength={120} />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share your experience…"
        rows={3}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button type="submit" size="sm" disabled={submitting} className="self-start">
        {submitting ? "Submitting…" : "Submit review"}
      </Button>
    </form>
  );
}
