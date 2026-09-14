import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { ReviewModerationActions } from "@/components/admin/review-moderation-actions";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  const reviews = await db.review.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { name: true, email: true } }, product: { select: { name: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Reviews</h1>
      <p className="mt-1 text-sm text-slate-500">{reviews.length} most recent</p>

      <ul className="mt-4 divide-y divide-slate-100">
        {reviews.map((review) => (
          <li key={review.id} className="flex items-start justify-between gap-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-slate-900">
                  {review.product.name} — {review.rating}/5
                </p>
                {review.hidden && <Badge className="border-red-300 bg-red-50 text-red-800">Hidden</Badge>}
              </div>
              <p className="text-xs text-slate-500">{review.user.email}</p>
              {review.body && <p className="mt-1 text-sm text-slate-600">{review.body}</p>}
            </div>
            <ReviewModerationActions reviewId={review.id} hidden={review.hidden} />
          </li>
        ))}
      </ul>
      {reviews.length === 0 && <p className="py-8 text-center text-slate-500">No reviews yet.</p>}
    </div>
  );
}
