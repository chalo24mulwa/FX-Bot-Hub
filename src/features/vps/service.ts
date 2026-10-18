import { invalidateCachePrefix } from "@/lib/cache";
import type { Prisma, VpsStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { recordAuditLog } from "@/repositories/audit-log-repository";
import { AdminError, type AdminActor } from "@/features/admin/core";
import { moveBy, placeAt, reorderWithin, slugify } from "@/lib/brokers/validation";
import { checkVpsImage, type VpsImageKind } from "@/lib/vps/images";
import { vpsInputSchema, vpsPublishBlockers } from "@/lib/vps/validation";

// VPS provider administration. Every function here is called only from actions that already passed
// `requirePermission("vps:manage")`; each change is audited (the audit log is append-only), and any ranking
// change renumbers the non-archived providers 1..n inside one transaction so positions never gap or collide.

type Tx = Prisma.TransactionClient;

const audit = (actor: AdminActor, action: string, id: string, metadata: Prisma.InputJsonValue) => {
  invalidateCachePrefix("vps:"); // every audited change here can alter a public page
  return recordAuditLog({ actorId: actor.id, action, entityType: "VpsProvider", entityId: id, metadata, ipAddress: actor.ipAddress });
};

async function rankedRows(tx: Tx) {
  return tx.vpsProvider.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, status: true }, orderBy: [{ position: "asc" }, { name: "asc" }] });
}

async function writeOrder(tx: Tx, orderedIds: readonly string[]) {
  for (let i = 0; i < orderedIds.length; i++) {
    await tx.vpsProvider.updateMany({ where: { id: orderedIds[i], status: { not: "ARCHIVED" }, NOT: { position: i + 1 } }, data: { position: i + 1 } });
  }
}

async function uniqueSlug(tx: Tx, name: string): Promise<string> {
  const base = slugify(name) || "vps-provider";
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    if (!(await tx.vpsProvider.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
  }
  throw new AdminError("Couldn't make a unique web address for that name. Try a slightly different name.");
}

export interface ImageUpload {
  bytes: Uint8Array;
}

export interface SaveOptions {
  logo?: ImageUpload | null;
  cover?: ImageUpload | null;
  removeLogo?: boolean;
  removeCover?: boolean;
}

type ImageColumns = Pick<Prisma.VpsProviderCreateInput, "logoData" | "logoMime" | "logoUpdatedAt" | "coverData" | "coverMime" | "coverUpdatedAt">;

const asDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`) : null);

/** Create (`id` null) or update a provider from the admin form. Status is never changed here. */
export async function saveVps(actor: AdminActor, id: string | null, rawInput: unknown, options: SaveOptions = {}) {
  const input = vpsInputSchema.parse(rawInput);

  const checked: Partial<Record<VpsImageKind, { mime: string; bytes: Uint8Array }>> = {};
  for (const kind of ["logo", "cover"] as const) {
    const upload = options[kind];
    if (!upload) continue;
    const result = checkVpsImage(upload.bytes, kind);
    if (!result.ok) throw new AdminError(result.error);
    checked[kind] = { mime: result.mime, bytes: upload.bytes };
  }

  const { position, price, ...fields } = input;
  const data = {
    ...fields,
    priceCents: price,
    offerExpiresAt: asDate(fields.offerExpiresAt),
    infoVerifiedAt: asDate(fields.infoVerifiedAt),
  };

  const imagePatch = (): Prisma.VpsProviderUpdateInput => ({
    ...(checked.logo
      ? { logoData: Uint8Array.from(checked.logo.bytes), logoMime: checked.logo.mime, logoUpdatedAt: new Date() }
      : options.removeLogo
        ? { logoData: null, logoMime: null, logoUpdatedAt: null }
        : {}),
    ...(checked.cover
      ? { coverData: Uint8Array.from(checked.cover.bytes), coverMime: checked.cover.mime, coverUpdatedAt: new Date() }
      : options.removeCover
        ? { coverData: null, coverMime: null, coverUpdatedAt: null }
        : {}),
  });

  const result = await db.$transaction(async (tx) => {
    const existing = id ? await tx.vpsProvider.findUnique({ where: { id } }) : null;
    if (id && !existing) throw new AdminError("That provider no longer exists.", 404);
    if (existing?.status === "ARCHIVED") throw new AdminError("Restore this provider before editing it.");

    // A live listing must stay publishable — an edit can't strip what the public page relies on.
    if (existing?.status === "PUBLISHED") {
      const blockers = vpsPublishBlockers(data);
      if (blockers.length) throw new AdminError(`This provider is live, so it needs: ${blockers.join(" ")}`);
    }

    let providerId: string;
    let slug: string;
    if (existing) {
      await tx.vpsProvider.update({ where: { id: existing.id }, data: { ...data, ...imagePatch() } });
      providerId = existing.id;
      slug = existing.slug;
    } else {
      slug = await uniqueSlug(tx, data.name);
      const created = await tx.vpsProvider.create({
        data: { ...data, slug, status: "DRAFT", position: 0, createdById: actor.id, ...(imagePatch() as ImageColumns) },
        select: { id: true },
      });
      providerId = created.id;
    }

    // Ranking. A new provider joins at the bottom; an explicit position places it within the published
    // ranking (what visitors see), leaving drafts where they are.
    const ranked = await rankedRows(tx);
    const statusById = new Map(ranked.map((r) => [r.id, r.status]));
    let order = ranked.map((r) => r.id);
    if (!existing) order = [...order.filter((x) => x !== providerId), providerId];
    if (position !== null) {
      const group = new Set(order.filter((rid) => statusById.get(rid) === "PUBLISHED" || rid === providerId));
      order = reorderWithin(order, group, placeAt(order.filter((rid) => group.has(rid)), providerId, position));
    }
    await writeOrder(tx, order);

    const changed = existing
      ? (Object.keys(data) as (keyof typeof data)[]).filter((key) => JSON.stringify(existing[key]) !== JSON.stringify(data[key]))
      : [];
    return { id: providerId, slug, created: !existing, changed };
  });

  await audit(actor, result.created ? "vps.create" : "vps.update", result.id, {
    name: input.name,
    changedFields: result.changed.map(String),
    logo: checked.logo ? "uploaded" : options.removeLogo ? "removed" : "unchanged",
    cover: checked.cover ? "uploaded" : options.removeCover ? "removed" : "unchanged",
    affiliateLink: input.affiliateUrl ? "set" : "none",
    topPick: input.featured,
  });
  return result;
}

export type VpsStatusOp = "publish" | "unpublish" | "archive" | "restore";

const FROM: Record<VpsStatusOp, VpsStatus[]> = {
  publish: ["DRAFT"],
  unpublish: ["PUBLISHED"],
  archive: ["DRAFT", "PUBLISHED"],
  restore: ["ARCHIVED"],
};

const PAST: Record<VpsStatusOp, string> = { publish: "published", unpublish: "unpublished", archive: "archived", restore: "restored" };

/** Publish / unpublish / archive / restore, applied only from a valid current status. */
export async function changeVpsStatus(actor: AdminActor, id: string, op: VpsStatusOp) {
  const name = await db.$transaction(async (tx) => {
    const row = await tx.vpsProvider.findUnique({ where: { id } });
    if (!row) throw new AdminError("That provider no longer exists.", 404);
    if (!FROM[op].includes(row.status)) throw new AdminError(`A ${row.status.toLowerCase()} provider can't be ${PAST[op]}.`);

    if (op === "publish") {
      const blockers = vpsPublishBlockers(row);
      if (blockers.length) throw new AdminError(`Before publishing: ${blockers.join(" ")}`);
    }

    const next: VpsStatus = op === "publish" ? "PUBLISHED" : op === "archive" ? "ARCHIVED" : "DRAFT";
    const moved = await tx.vpsProvider.updateMany({
      where: { id, status: row.status },
      data: {
        status: next,
        ...(op === "publish" ? { publishedAt: row.publishedAt ?? new Date() } : {}),
        ...(op === "archive" ? { position: 0, featured: false } : {}),
      },
    });
    if (moved.count === 0) throw new AdminError("Someone else just changed this provider. Refresh and try again.");

    if (op === "archive" || op === "restore") {
      const order = (await rankedRows(tx)).map((r) => r.id);
      await writeOrder(tx, op === "restore" ? [...order.filter((x) => x !== id), id] : order);
    }
    return row.name;
  });
  await audit(actor, `vps.${op}`, id, { name });
  return { name };
}

/** Moves a provider one place up or down within its own group (published among published, drafts among drafts). */
export async function moveVps(actor: AdminActor, id: string, direction: "up" | "down") {
  const result = await db.$transaction(async (tx) => {
    const ranked = await rankedRows(tx);
    const me = ranked.find((r) => r.id === id);
    if (!me) throw new AdminError("Only providers that aren't archived can be ranked.");
    const group = ranked.filter((r) => r.status === me.status).map((r) => r.id);
    const before = ranked.map((r) => r.id);
    const after = reorderWithin(before, new Set(group), moveBy(group, id, direction === "up" ? -1 : 1));
    if (after.join() === before.join()) return { moved: false };
    await writeOrder(tx, after);
    return { moved: true };
  });
  if (result.moved) await audit(actor, "vps.reorder", id, { direction });
  return result;
}

export async function deleteVps(actor: AdminActor, id: string) {
  const row = await db.vpsProvider.findUnique({ where: { id }, select: { id: true, name: true, status: true, slug: true } });
  if (!row) throw new AdminError("That provider no longer exists.", 404);
  await db.$transaction(async (tx) => {
    await tx.vpsProvider.delete({ where: { id } });
    if (row.status !== "ARCHIVED") await writeOrder(tx, (await rankedRows(tx)).map((r) => r.id));
  });
  await audit(actor, "vps.delete", id, { name: row.name, slug: row.slug, status: row.status });
  return { name: row.name };
}
