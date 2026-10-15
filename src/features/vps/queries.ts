import type { Prisma, VpsStatus } from "@prisma/client";
import { db } from "@/lib/db";

// Reads for the VPS pages. Image bytes are never selected here (they're large and are served by
// /api/vps/[id]/logo|cover), and `createdById` stays admin-side.
const VIEW_SELECT = {
  id: true,
  slug: true,
  name: true,
  status: true,
  position: true,
  featured: true,
  sponsored: true,
  disclosureNote: true,
  officialUrl: true,
  affiliateUrl: true,
  ctaLabel: true,
  promoCode: true,
  offerText: true,
  offerExpiresAt: true,
  logoMime: true,
  logoUpdatedAt: true,
  coverMime: true,
  coverUpdatedAt: true,
  category: true,
  headline: true,
  description: true,
  features: true,
  bestFor: true,
  operatingSystems: true,
  serverLocations: true,
  platforms: true,
  cpu: true,
  ram: true,
  storage: true,
  otherSpecs: true,
  priceCents: true,
  priceCurrency: true,
  pricePeriod: true,
  freeTrial: true,
  trialNote: true,
  latencyInfo: true,
  latencySource: true,
  whyRecommend: true,
  advantages: true,
  limitations: true,
  rating: true,
  ratingNote: true,
  seoTitle: true,
  seoDescription: true,
  infoVerifiedAt: true,
  publishedAt: true,
  updatedAt: true,
} satisfies Prisma.VpsProviderSelect;

export type VpsView = Prisma.VpsProviderGetPayload<{ select: typeof VIEW_SELECT }>;

const ORDER: Prisma.VpsProviderOrderByWithRelationInput[] = [{ position: "asc" }, { name: "asc" }];

/** Published providers in ranking order — the only thing the public page ever lists. */
export function listPublishedVps(): Promise<VpsView[]> {
  return db.vpsProvider.findMany({ where: { status: "PUBLISHED" }, select: VIEW_SELECT, orderBy: ORDER });
}

export function getPublishedVps(slug: string): Promise<VpsView | null> {
  return db.vpsProvider.findFirst({ where: { slug, status: "PUBLISHED" }, select: VIEW_SELECT });
}

// ---- admin ------------------------------------------------------------------------------------

export function getVpsForAdmin(id: string): Promise<VpsView | null> {
  return db.vpsProvider.findUnique({ where: { id }, select: VIEW_SELECT });
}

/** Every provider for the admin list: ranked ones first (in ranking order), archived ones last. */
export async function listVpsForAdmin(status?: VpsStatus): Promise<VpsView[]> {
  const rows = await db.vpsProvider.findMany({ where: status ? { status } : undefined, select: VIEW_SELECT, orderBy: ORDER });
  return [...rows.filter((r) => r.status !== "ARCHIVED"), ...rows.filter((r) => r.status === "ARCHIVED")];
}

export async function countVpsByStatus(): Promise<Record<VpsStatus, number>> {
  const grouped = await db.vpsProvider.groupBy({ by: ["status"], _count: { _all: true } });
  const counts: Record<VpsStatus, number> = { DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 };
  for (const row of grouped) counts[row.status] = row._count._all;
  return counts;
}
