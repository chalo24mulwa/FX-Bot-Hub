"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/authorization";
import { db } from "@/lib/db";
import {
  createProductSchema,
  updateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from "@/lib/validations/product";
import * as productService from "@/server/services/product-service";
import * as reviewService from "@/features/reviews/review-service";

function formDataToProductInput(formData: FormData) {
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const features = String(formData.get("features") ?? "")
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);

  return {
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? ""),
    platform: String(formData.get("platform") ?? ""),
    categoryId: String(formData.get("categoryId") ?? "") || undefined,
    shortSummary: String(formData.get("shortSummary") ?? ""),
    description: String(formData.get("description") ?? ""),
    features,
    requirements: String(formData.get("requirements") ?? "") || undefined,
    installationInstructions: String(formData.get("installationInstructions") ?? "") || undefined,
    compatibilityNotes: String(formData.get("compatibilityNotes") ?? "") || undefined,
    supportInfo: String(formData.get("supportInfo") ?? "") || undefined,
    pricingType: String(formData.get("pricingType") ?? "ONE_TIME"),
    priceCents: Number(formData.get("priceCents") ?? 0),
    currency: String(formData.get("currency") ?? "USD"),
    tags,
  };
}

// ---------- Form (FormData) actions — used by the single-page edit form ----------

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

// ---------- Typed-object actions — used by the multi-step wizard ----------

export async function createProductFromDataAction(input: CreateProductInput) {
  const session = await requirePermission("product:create");
  const parsed = createProductSchema.parse(input);
  return productService.createDraftProduct(session.user.id, parsed);
}

export async function updateProductFromDataAction(productId: string, input: UpdateProductInput) {
  const session = await requirePermission("product:edit_own");
  const parsed = updateProductSchema.parse(input);
  const updated = await productService.updateOwnProduct(session.user.id, productId, parsed);
  if (!updated) throw new Error("Product not found or not owned by you.");
  return updated;
}

export async function submitForReviewAction(productId: string) {
  const session = await requirePermission("product:edit_own");
  const ok = await productService.submitProductForReview(session.user.id, productId);
  if (!ok) throw new Error("Product not found, not owned by you, or not in a submittable state.");
  revalidatePath(`/seller/products/${productId}`);
  revalidatePath("/seller/products");
}

export async function respondToReviewAction(reviewId: string, response: string) {
  const session = await requirePermission("product:edit_own");
  await reviewService.respondToReview(session.user.id, reviewId, response);
  revalidatePath("/seller/reviews");
}

export async function updateSellerProfileAction(formData: FormData) {
  const session = await requirePermission("seller:view_dashboard");
  await db.sellerProfile.upsert({
    where: { userId: session.user.id },
    update: {
      displayName: String(formData.get("displayName") ?? ""),
      bio: String(formData.get("bio") ?? "") || null,
      websiteUrl: String(formData.get("websiteUrl") ?? "") || null,
    },
    create: {
      userId: session.user.id,
      displayName: String(formData.get("displayName") ?? ""),
      bio: String(formData.get("bio") ?? "") || null,
      websiteUrl: String(formData.get("websiteUrl") ?? "") || null,
    },
  });
  revalidatePath("/seller/profile");
}

export async function updatePayoutSettingsAction(formData: FormData) {
  const session = await requirePermission("seller:view_dashboard");
  await db.sellerProfile.upsert({
    where: { userId: session.user.id },
    update: { payoutEmail: String(formData.get("payoutEmail") ?? "") || null },
    create: {
      userId: session.user.id,
      displayName: session.user.name ?? "Seller",
      payoutEmail: String(formData.get("payoutEmail") ?? "") || null,
    },
  });
  revalidatePath("/seller/payout");
}
