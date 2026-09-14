import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnProduct } from "@/server/services/product-service";
import { listProductAssets } from "@/features/seller/asset-service";
import { ProductForm } from "@/components/seller/product-form";
import { SubmitForReviewButton } from "@/components/seller/submit-for-review-button";
import { ProductAssetsManager } from "@/components/seller/product-assets-manager";
import { Badge } from "@/components/ui/badge";
import { updateProductAction, submitForReviewAction } from "@/features/seller/actions";

export const dynamic = "force-dynamic";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  const session = await auth();
  const [product, categories, assets] = await Promise.all([
    getOwnProduct(session!.user.id, id),
    db.productCategory.findMany({ orderBy: { name: "asc" } }),
    listProductAssets(session!.user.id, id),
  ]);
  if (!product) notFound();

  const boundUpdate = updateProductAction.bind(null, product.id);

  return (
    <div>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">{product.name}</h1>
        <Badge>{product.status.replace("_", " ")}</Badge>
      </div>

      {product.status === "REJECTED" && product.rejectionReason && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">Rejection reason</p>
          <p>{product.rejectionReason}</p>
        </div>
      )}

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
            features: product.features,
            requirements: product.requirements,
            installationInstructions: product.installationInstructions,
            compatibilityNotes: product.compatibilityNotes,
            supportInfo: product.supportInfo,
            tags: product.tags,
          }}
        />
      </div>

      <div className="mt-10 border-t border-slate-200 pt-8">
        <h2 className="text-lg font-semibold text-slate-900">Media &amp; files</h2>
        <ProductAssetsManager productId={product.id} {...assets} />
      </div>
    </div>
  );
}
