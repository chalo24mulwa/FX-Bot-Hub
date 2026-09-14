import { auth } from "@/lib/auth";
import { listSellerReviews } from "@/features/seller/analytics-service";
import { Badge } from "@/components/ui/badge";
import { ReviewResponseForm } from "@/components/seller/review-response-form";

export const dynamic = "force-dynamic";

export default async function SellerReviewsPage() {
  const session = await auth();
  const reviews = await listSellerReviews(session!.user.id);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Reviews</h1>

      {reviews.length === 0 ? (
        <p className="mt-4 text-slate-500">No reviews yet.</p>
      ) : (
        <ul className="mt-4 space-y-6">
          {reviews.map((review) => (
            <li key={review.id} className="border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <p className="font-medium text-slate-900">
                  {review.product.name} — {review.rating}/5
                </p>
                {review.verifiedPurchase && (
                  <Badge className="border-emerald-300 bg-emerald-50 text-emerald-800">Verified</Badge>
                )}
                {review.hidden && <Badge className="border-red-300 bg-red-50 text-red-800">Hidden by admin</Badge>}
              </div>
              <p className="text-xs text-slate-500">by {review.user.name}</p>
              {review.body && <p className="mt-1 text-sm text-slate-600">{review.body}</p>}
              <ReviewResponseForm reviewId={review.id} existing={review.sellerResponse} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
