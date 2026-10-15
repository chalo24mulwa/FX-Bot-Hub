import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { can } from "@/lib/authorization/permissions";
import { getListingDetail } from "@/features/admin/listing-admin-service";
import { requireAdminPage } from "@/features/admin/viewer";
import { ListingControls, ListingEditForm } from "@/components/admin/listing-admin-controls";
import { ProductCover } from "@/components/marketplace/product-cover";
import { Badge } from "@/components/ui/badge";
import { formatPriceCents } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-slate-200 pt-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

export default async function AdminProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireAdminPage("product:moderate");
  const { id } = await params;
  const detail = await getListingDetail(id);
  if (!detail) notFound();
  const { product, history, blockers } = detail;
  const categories = await db.productCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  const deleteBlocked = !can(viewer, "product:delete_any")
    ? "your role can't delete listings."
    : blockers.blocked
      ? `it has ${blockers.orderItems} order item(s), ${blockers.licenses} licence(s) and ${blockers.subscriptions} subscription(s). Deleting would erase that purchase history — use Remove instead.`
      : null;

  return (
    <div>
      <Link href="/admin/products" className="text-xs text-blue-600 hover:underline">
        ← All products
      </Link>
      <div className="mt-2 flex flex-wrap items-start gap-4">
        <ProductCover image={product.images[0]} name={product.name} compact sizes="160px" className="h-24 w-40 rounded" />
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{product.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge>{product.status === "ARCHIVED" ? "REMOVED" : product.status.replace("_", " ")}</Badge>
            {product.featured && <Badge>Featured</Badge>}
            <Badge>{product.type}</Badge>
            <Badge>{product.platform}</Badge>
          </div>
          {product.status === "PUBLISHED" && (
            <p className="mt-2 text-xs">
              <Link href={`/marketplace/${product.slug}`} className="text-blue-600 hover:underline">
                View public page →
              </Link>
            </p>
          )}
        </div>
      </div>

      {product.rejectionReason && (
        <p className="mt-4 max-w-2xl rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Reason shown to the seller:</strong> {product.rejectionReason}
        </p>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Fact label="Seller">
          <Link href={`/admin/users/${product.seller.id}`} className="text-blue-600 hover:underline">
            {product.seller.name ?? product.seller.email}
          </Link>
          {product.seller.bannedAt && <span className="ml-1 text-xs text-red-600">(suspended)</span>}
        </Fact>
        <Fact label="Category">{product.category?.name ?? "—"}</Fact>
        <Fact label="Price">{product.pricingType === "FREE" ? "Free" : `${formatPriceCents(product.priceCents)}${product.pricingType === "SUBSCRIPTION" ? " / month" : ""}`}</Fact>
        <Fact label="Created">{product.createdAt.toLocaleDateString()}</Fact>
        <Fact label="Last updated">{product.updatedAt.toLocaleDateString()}</Fact>
        <Fact label="Published">{product.publishedAt ? product.publishedAt.toLocaleDateString() : "Never"}</Fact>
        <Fact label="Versions / files">{product._count.versions}</Fact>
        <Fact label="Views">{product.viewCount}</Fact>
      </dl>

      <Section title="Moderation">
        <ListingControls productId={product.id} status={product.status} deleteBlocked={deleteBlocked} />
      </Section>

      <Section title="Purchases">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Fact label="Order items">{product._count.orderItems}</Fact>
          <Fact label="Licences">{product._count.licenses}</Fact>
          <Fact label="Subscriptions">{product._count.subscriptions}</Fact>
          <Fact label="Downloads">{product._count.downloads}</Fact>
          <Fact label="Reviews">{product._count.reviews}</Fact>
        </dl>
        <p className="mt-2 text-xs text-slate-500">Suspending or removing a listing hides it from the marketplace but never touches these — existing buyers keep their licences and downloads.</p>
      </Section>

      <Section title="Description">
        <p className="text-sm font-medium text-slate-800">{product.shortSummary}</p>
        <p className="mt-2 max-w-3xl whitespace-pre-line text-sm text-slate-600">{product.description.slice(0, 2500)}{product.description.length > 2500 ? "…" : ""}</p>
        {product.tags.length > 0 && <p className="mt-2 text-xs text-slate-500">Tags: {product.tags.join(", ")}</p>}
      </Section>

      {can(viewer, "product:edit_any") && (
        <Section title="Edit listing">
          <ListingEditForm
            productId={product.id}
            initial={{ name: product.name, shortSummary: product.shortSummary, description: product.description, categoryId: product.categoryId ?? "" }}
            categories={categories}
          />
        </Section>
      )}

      <Section title="Moderation history">
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">No moderation actions yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
            {history.map((log) => {
              const reason = (log.metadata as { reason?: string } | null)?.reason;
              return (
                <li key={log.id} className="px-3 py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span>
                      <span className="font-mono text-xs text-slate-800">{log.action}</span>
                      <span className="ml-2 text-slate-500">{log.actor?.name ?? log.actor?.email ?? "system"}</span>
                    </span>
                    <time className="text-xs text-slate-400" dateTime={log.createdAt.toISOString()}>
                      {log.createdAt.toLocaleString()}
                    </time>
                  </div>
                  {reason && <p className="mt-1 text-xs text-slate-600">Reason: {reason}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
