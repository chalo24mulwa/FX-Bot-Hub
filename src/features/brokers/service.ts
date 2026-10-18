import { invalidateCachePrefix } from "@/lib/cache";
import type { BrokerStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { recordAuditLog } from "@/repositories/audit-log-repository";
import { AdminError, type AdminActor } from "@/features/admin/core";
import { checkLogo } from "@/lib/brokers/logo";
import { brokerInputSchema, moveBy, placeAt, publishBlockers, reorderWithin, slugify } from "@/lib/brokers/validation";

// Best Brokers administration. Every function here is called only from actions that already passed
// `requirePermission("broker:manage")`; each change is audited (the audit log is append-only), and any
// ranking change renumbers the non-archived brokers 1..n inside one transaction so positions never gap
// or collide.

type Tx = Prisma.TransactionClient;

const audit = (actor: AdminActor, action: string, brokerId: string, metadata: Prisma.InputJsonValue) => {
  invalidateCachePrefix("brokers:"); // every audited change here can alter a public page
  return recordAuditLog({ actorId: actor.id, action, entityType: "Broker", entityId: brokerId, metadata, ipAddress: actor.ipAddress });
};

/** Ranked brokers (everything but archived) in current order, with the status each one has. */
async function rankedRows(tx: Tx) {
  return tx.broker.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, status: true }, orderBy: [{ position: "asc" }, { name: "asc" }] });
}

async function writeOrder(tx: Tx, orderedIds: readonly string[]) {
  for (let i = 0; i < orderedIds.length; i++) {
    await tx.broker.updateMany({ where: { id: orderedIds[i], status: { not: "ARCHIVED" }, NOT: { position: i + 1 } }, data: { position: i + 1 } });
  }
}

async function uniqueSlug(tx: Tx, name: string): Promise<string> {
  const base = slugify(name) || "broker";
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    if (!(await tx.broker.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
  }
  throw new AdminError("Couldn't make a unique web address for that name. Try a slightly different name.");
}

export interface LogoUpload {
  bytes: Uint8Array;
}

export interface SaveOptions {
  logo?: LogoUpload | null;
  removeLogo?: boolean;
}

/** Create (`id` null) or update a broker from the admin form. Status is never changed here. */
export async function saveBroker(actor: AdminActor, id: string | null, rawInput: unknown, options: SaveOptions = {}) {
  const input = brokerInputSchema.parse(rawInput);

  let logo: { mime: string; bytes: Uint8Array } | null = null;
  if (options.logo) {
    const checked = checkLogo(options.logo.bytes);
    if (!checked.ok) throw new AdminError(checked.error);
    logo = { mime: checked.mime, bytes: options.logo.bytes };
  }

  const { position, ...fields } = input;
  const data = {
    ...fields,
    infoVerifiedAt: fields.infoVerifiedAt ? new Date(`${fields.infoVerifiedAt}T00:00:00Z`) : null,
  };

  const result = await db.$transaction(async (tx) => {
    const existing = id ? await tx.broker.findUnique({ where: { id } }) : null;
    if (id && !existing) throw new AdminError("That broker no longer exists.", 404);
    if (existing?.status === "ARCHIVED") throw new AdminError("Restore this broker before editing it.");

    // A live listing must stay publishable — an edit can't strip what the public page relies on.
    if (existing?.status === "PUBLISHED") {
      const blockers = publishBlockers({ ...data, officialUrl: data.officialUrl });
      if (blockers.length) throw new AdminError(`This broker is live, so it needs: ${blockers.join(" ")}`);
    }

    const logoPatch: Prisma.BrokerUpdateInput = logo
      ? { logoData: Uint8Array.from(logo.bytes), logoMime: logo.mime, logoUpdatedAt: new Date() }
      : options.removeLogo
        ? { logoData: null, logoMime: null, logoUpdatedAt: null }
        : {};

    let brokerId: string;
    let slug: string;
    if (existing) {
      await tx.broker.update({ where: { id: existing.id }, data: { ...data, ...logoPatch } });
      brokerId = existing.id;
      slug = existing.slug;
    } else {
      slug = await uniqueSlug(tx, data.name);
      const created = await tx.broker.create({
        data: { ...data, slug, status: "DRAFT", position: 0, createdById: actor.id, ...(logo ? { logoData: Uint8Array.from(logo.bytes), logoMime: logo.mime, logoUpdatedAt: new Date() } : {}) },
        select: { id: true },
      });
      brokerId = created.id;
    }

    // Ranking. A new broker joins at the bottom; an explicit position places it within the published
    // ranking (the brokers visitors actually see), leaving drafts where they are.
    const ranked = await rankedRows(tx);
    const statusById = new Map(ranked.map((r) => [r.id, r.status]));
    let order = ranked.map((r) => r.id);
    if (!existing) order = [...order.filter((x) => x !== brokerId), brokerId];
    if (position !== null) {
      const group = new Set(order.filter((rid) => statusById.get(rid) === "PUBLISHED" || rid === brokerId));
      order = reorderWithin(order, group, placeAt(order.filter((rid) => group.has(rid)), brokerId, position));
    }
    await writeOrder(tx, order);

    const changed = existing
      ? (Object.keys(data) as (keyof typeof data)[]).filter((key) => JSON.stringify(existing[key]) !== JSON.stringify(data[key]))
      : [];
    return { id: brokerId, slug, created: !existing, changed };
  });

  await audit(actor, result.created ? "broker.create" : "broker.update", result.id, {
    name: input.name,
    changedFields: result.changed.map(String),
    logo: logo ? "uploaded" : options.removeLogo ? "removed" : "unchanged",
    affiliateLink: input.affiliateUrl ? "set" : "none",
  });
  return result;
}

export type StatusOp = "publish" | "unpublish" | "archive" | "restore";

const FROM: Record<StatusOp, BrokerStatus[]> = {
  publish: ["DRAFT"],
  unpublish: ["PUBLISHED"],
  archive: ["DRAFT", "PUBLISHED"],
  restore: ["ARCHIVED"],
};

/** Publish / unpublish / archive / restore, applied only from a valid current status. */
export async function changeBrokerStatus(actor: AdminActor, id: string, op: StatusOp) {
  const name = await db.$transaction(async (tx) => {
    const broker = await tx.broker.findUnique({ where: { id } });
    if (!broker) throw new AdminError("That broker no longer exists.", 404);
    if (!FROM[op].includes(broker.status)) throw new AdminError(`A ${broker.status.toLowerCase()} broker can't be ${op === "publish" ? "published" : op === "unpublish" ? "unpublished" : op === "archive" ? "archived" : "restored"}.`);

    if (op === "publish") {
      const blockers = publishBlockers(broker);
      if (blockers.length) throw new AdminError(`Before publishing: ${blockers.join(" ")}`);
    }

    const next: BrokerStatus = op === "publish" ? "PUBLISHED" : op === "unpublish" ? "DRAFT" : op === "archive" ? "ARCHIVED" : "DRAFT";
    const moved = await tx.broker.updateMany({
      where: { id, status: broker.status },
      data: {
        status: next,
        ...(op === "publish" ? { publishedAt: broker.publishedAt ?? new Date() } : {}),
        ...(op === "archive" ? { position: 0, featured: false } : {}),
      },
    });
    if (moved.count === 0) throw new AdminError("Someone else just changed this broker. Refresh and try again.");

    // Archive/restore change who is ranked, so re-number everyone (a restored broker joins at the bottom).
    if (op === "archive" || op === "restore") {
      const ranked = await rankedRows(tx);
      const order = ranked.map((r) => r.id);
      await writeOrder(tx, op === "restore" ? [...order.filter((x) => x !== id), id] : order);
    }
    return broker.name;
  });
  await audit(actor, `broker.${op}`, id, { name });
  return { name };
}

/** Moves a broker one place up or down within its own group (published among published, drafts among drafts). */
export async function moveBroker(actor: AdminActor, id: string, direction: "up" | "down") {
  const result = await db.$transaction(async (tx) => {
    const ranked = await rankedRows(tx);
    const me = ranked.find((r) => r.id === id);
    if (!me) throw new AdminError("Only brokers that aren't archived can be ranked.");
    const group = ranked.filter((r) => r.status === me.status).map((r) => r.id);
    const before = ranked.map((r) => r.id);
    const after = reorderWithin(before, new Set(group), moveBy(group, id, direction === "up" ? -1 : 1));
    if (after.join() === before.join()) return { moved: false };
    await writeOrder(tx, after);
    return { moved: true };
  });
  if (result.moved) await audit(actor, "broker.reorder", id, { direction });
  return result;
}

export async function deleteBroker(actor: AdminActor, id: string) {
  const broker = await db.broker.findUnique({ where: { id }, select: { id: true, name: true, status: true, slug: true } });
  if (!broker) throw new AdminError("That broker no longer exists.", 404);
  await db.$transaction(async (tx) => {
    await tx.broker.delete({ where: { id } });
    if (broker.status !== "ARCHIVED") await writeOrder(tx, (await rankedRows(tx)).map((r) => r.id));
  });
  await audit(actor, "broker.delete", id, { name: broker.name, slug: broker.slug, status: broker.status });
  return { name: broker.name };
}
