import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnProduct } from "@/server/services/product-service";
import { ProductForm } from "@/components/seller/product-form";
import { SubmitForReviewButton } from "@/components/seller/submit-for-review-button";
import { Badge } from "@/components/ui/badge";
import { updateProductAction, submitForReviewAction } from "@/features/seller/actions";

export const dynamic = "force-dynamic";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  const session = await auth();
  const [product, categories] = await Promise.all([
    getOwnProduct(session!.user.id, id),
    db.productCategory.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!product) notFound();

  const boundUpdate = updateProductAction.bind(null, product.id);

  return (
    <div>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">{product.name}</h1>
        <Badge>{product.status.replace("_", " ")}</Badge>
      </div>

      {(product.status === "DRAFT" || product.status === "REJECTED") && (
        <div className="mt-3">
          <SubmitForReviewButton action={submitForReviewAction.bind(null, product.id)} />
        </div>
      )}

      <div className="mt-6">
        <ProductForm
          action={boundUpdate}
          categories={categories}
          submitLabel="Save changes"
          defaults={{
            name: product.name,
            type: product.type,
            platform: product.platform,
            pricingType: product.pricingType,
            priceCents: product.priceCents,
            currency: product.currency,
            categoryId: product.categoryId,
            shortSummary: product.shortSummary,
            description: product.description,
            tags: product.tags,
          }}
        />
      </div>
    </div>
  );
}
