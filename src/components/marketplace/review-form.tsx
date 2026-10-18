"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STAR_PATH = "M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.5l-5.88 3.11 1.12-6.55L2.48 9.42l6.58-.96L12 2.5z";

/**
 * Rate (1–5 stars, required) and optionally review a product you bought. The same form edits your existing review: it opens pre-filled
 * and saves over it — the server keeps exactly one review per customer per product. Nothing is pre-selected, so a rating is always a
 * deliberate choice.
 */
export function ReviewForm({
  productId,
  initial,
}: {
  productId: string;
  initial?: { rating: number; title: string | null; body: string | null };
}) {
  const router = useRouter();
  const editing = !!initial;
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (rating < 1) {
      setError("Choose a rating from 1 to 5 stars.");
      return;
    }
    setSubmitting(true);

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
    setSaved(true);
    router.refresh();
  }

  const shown = hover || rating;

  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-2 rounded-md border border-slate-200 p-4">
      <p className="text-sm font-medium text-slate-900">{editing ? "Edit your review" : "Write a review"}</p>
      <div className="flex" role="group" aria-label="Your rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHover(star)}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            aria-pressed={rating === star}
            className={`flex h-10 w-10 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
              star <= shown ? "text-amber-500" : "text-slate-300"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
              <path d={STAR_PATH} />
            </svg>
          </button>
        ))}
      </div>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" maxLength={120} aria-label="Review title" />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share your experience…"
        aria-label="Your review"
        rows={3}
        maxLength={4000}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
      {saved && !error && (
        <p role="status" className="text-xs text-emerald-700">
          {editing ? "Review updated." : "Thanks — your review is saved."}
        </p>
      )}
      <Button type="submit" size="sm" disabled={submitting} className="self-start">
        {submitting ? "Saving…" : editing ? "Update review" : "Submit review"}
      </Button>
    </form>
  );
}
