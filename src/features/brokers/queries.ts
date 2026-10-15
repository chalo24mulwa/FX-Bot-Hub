import type { BrokerStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// Reads for the Best Brokers pages. The logo bytes are never selected here (they're large and are
// served by /api/brokers/[id]/logo), and `createdById` stays admin-side — public pages only ever
// see this shape.
const VIEW_SELECT = {
  id: true,
  slug: true,
  name: true,
  status: true,
  position: true,
  featured: true,
  officialUrl: true,
  affiliateUrl: true,
  sponsored: true,
  logoMime: true,
  logoUpdatedAt: true,
  tagline: true,
  features: true,
  whySelected: true,
  bestFor: true,
  platforms: true,
  instruments: true,
  accountTypes: true,
  minDeposit: true,
  spreadsInfo: true,
  regulation: true,
  rating: true,
  ratingNote: true,
  infoVerifiedAt: true,
  publishedAt: true,
  updatedAt: true,
} satisfies Prisma.BrokerSelect;

export type BrokerView = Prisma.BrokerGetPayload<{ select: typeof VIEW_SELECT }>;

const ORDER: Prisma.BrokerOrderByWithRelationInput[] = [{ position: "asc" }, { name: "asc" }];

/** Published brokers in ranking order — the only thing the public page ever lists. */
export function listPublishedBrokers(): Promise<BrokerView[]> {
  return db.broker.findMany({ where: { status: "PUBLISHED" }, select: VIEW_SELECT, orderBy: ORDER });
}

export function getPublishedBroker(slug: string): Promise<BrokerView | null> {
  return db.broker.findFirst({ where: { slug, status: "PUBLISHED" }, select: VIEW_SELECT });
}

// ---- admin ------------------------------------------------------------------------------------

export function getBrokerForAdmin(id: string): Promise<BrokerView | null> {
  return db.broker.findUnique({ where: { id }, select: VIEW_SELECT });
}

/** Every broker for the admin list: ranked ones first (in ranking order), archived ones last. */
export async function listBrokersForAdmin(status?: BrokerStatus): Promise<BrokerView[]> {
  const rows = await db.broker.findMany({ where: status ? { status } : undefined, select: VIEW_SELECT, orderBy: ORDER });
  return [...rows.filter((r) => r.status !== "ARCHIVED"), ...rows.filter((r) => r.status === "ARCHIVED")];
}

export async function countBrokersByStatus(): Promise<Record<BrokerStatus, number>> {
  const grouped = await db.broker.groupBy({ by: ["status"], _count: { _all: true } });
  const counts: Record<BrokerStatus, number> = { DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 };
  for (const row of grouped) counts[row.status] = row._count._all;
  return counts;
}

/** Public rank of each published broker = its place in the published ordering (1 = top). */
export function rankOf(published: readonly { id: string }[], id: string): number {
  return published.findIndex((b) => b.id === id) + 1;
}
