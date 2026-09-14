import { db } from "@/lib/db";
import { ProductWizard } from "@/components/seller/product-wizard";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const categories = await db.productCategory.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">New product</h1>
      <p className="mt-1 text-sm text-slate-500">
        Saved as a draft as you go — you can leave and come back before submitting for review.
      </p>
      <div className="mt-6">
        <ProductWizard categories={categories} />
      </div>
    </div>
  );
}
