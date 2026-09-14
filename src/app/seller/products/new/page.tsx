import { db } from "@/lib/db";
import { ProductForm } from "@/components/seller/product-form";
import { createProductAction } from "@/features/seller/actions";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const categories = await db.productCategory.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">New product</h1>
      <p className="mt-1 text-sm text-slate-500">Saved as a draft — submit for review when ready.</p>
      <div className="mt-6">
        <ProductForm action={createProductAction} categories={categories} submitLabel="Create draft" />
      </div>
    </div>
  );
}
