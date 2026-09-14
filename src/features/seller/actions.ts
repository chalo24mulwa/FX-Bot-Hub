"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/authorization";
import { createProductSchema, updateProductSchema } from "@/lib/validations/product";
import * as productService from "@/server/services/product-service";

function formDataToProductInput(formData: FormData) {
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return {
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? ""),
    platform: String(formData.get("platform") ?? ""),
    categoryId: String(formData.get("categoryId") ?? "") || undefined,
    shortSummary: String(formData.get("shortSummary") ?? ""),
    description: String(formData.get("description") ?? ""),
    pricingType: String(formData.get("pricingType") ?? "ONE_TIME"),
    priceCents: Number(formData.get("priceCents") ?? 0),
    currency: String(formData.get("currency") ?? "USD"),
    tags,
  };
}

export async function createProductAction(formData: FormData) {
  const session = await requirePermission("product:create");
  const input = createProductSchema.parse(formDataToProductInput(formData));
  const product = await productService.createDraftProduct(session.user.id, input);
  revalidatePath("/seller/products");
  redirect(`/seller/products/${product.id}`);
}

export async function updateProductAction(productId: string, formData: FormData) {
  const session = await requirePermission("product:edit_own");
  const input = updateProductSchema.parse(formDataToProductInput(formData));
  const updated = await productService.updateOwnProduct(session.user.id, productId, input);
  if (!updated) throw new Error("Product not found or not owned by you.");
  revalidatePath(`/seller/products/${productId}`);
  revalidatePath("/seller/products");
}

export async function submitForReviewAction(productId: string) {
  const session = await requirePermission("product:edit_own");
  const ok = await productService.submitProductForReview(session.user.id, productId);
  if (!ok) throw new Error("Product not found, not owned by you, or not in a submittable state.");
  revalidatePath(`/seller/products/${productId}`);
  revalidatePath("/seller/products");
}
