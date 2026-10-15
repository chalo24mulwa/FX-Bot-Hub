"use server";

import { revalidatePath } from "next/cache";
import { AdminError, runAdminAction, type AdminResult } from "@/features/admin/core";
import { MAX_BYTES, type VpsImageKind } from "@/lib/vps/images";
import { changeVpsStatus, deleteVps, moveVps, saveVps, type ImageUpload, type VpsStatusOp } from "./service";

// Server Actions for /admin/vps. Each one re-checks `vps:manage` on the server (the page that rendered the
// button is never the guard), is rate-limited per administrator, and refreshes the public pages so a
// publish/edit/reorder shows up immediately.

const RATE = { bucket: "vps-admin", limit: 120, windowSeconds: 300 };

function refresh() {
  revalidatePath("/vps", "layout");
  revalidatePath("/admin/vps", "layout");
  revalidatePath("/sitemap.xml");
}

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};
const numberOrNull = (raw: string): number | null => {
  const v = raw.trim();
  return v === "" ? null : Number(v);
};
const list = (form: FormData, key: string) => [...form.getAll(key).map(String), text(form, `${key}Custom`)].flatMap((v) => v.split(/[\n,]+/));

/** Turns the submitted form into the raw object the shared schema validates. */
function formToInput(form: FormData) {
  return {
    name: text(form, "name"),
    category: text(form, "category"),
    headline: text(form, "headline"),
    description: text(form, "description"),
    officialUrl: text(form, "officialUrl"),
    affiliateUrl: text(form, "affiliateUrl"),
    ctaLabel: text(form, "ctaLabel"),
    promoCode: text(form, "promoCode"),
    offerText: text(form, "offerText"),
    offerExpiresAt: text(form, "offerExpiresAt"),
    sponsored: form.get("sponsored") === "on",
    disclosureNote: text(form, "disclosureNote"),
    featured: form.get("featured") === "on",
    features: [text(form, "features")],
    advantages: [text(form, "advantages")],
    limitations: [text(form, "limitations")],
    whyRecommend: text(form, "whyRecommend"),
    bestFor: list(form, "bestFor"),
    operatingSystems: list(form, "operatingSystems"),
    serverLocations: [text(form, "serverLocations")].flatMap((v) => v.split(/[\n,]+/)),
    platforms: list(form, "platforms"),
    cpu: text(form, "cpu"),
    ram: text(form, "ram"),
    storage: text(form, "storage"),
    otherSpecs: text(form, "otherSpecs"),
    price: text(form, "price"),
    priceCurrency: text(form, "priceCurrency"),
    pricePeriod: text(form, "pricePeriod"),
    freeTrial: form.get("freeTrial") === "on",
    trialNote: text(form, "trialNote"),
    latencyInfo: text(form, "latencyInfo"),
    latencySource: text(form, "latencySource"),
    rating: numberOrNull(text(form, "rating")),
    ratingNote: text(form, "ratingNote"),
    seoTitle: text(form, "seoTitle"),
    seoDescription: text(form, "seoDescription"),
    infoVerifiedAt: text(form, "infoVerifiedAt").trim() || null,
    position: numberOrNull(text(form, "position")),
  };
}

async function readImage(form: FormData, kind: VpsImageKind): Promise<ImageUpload | null> {
  const file = form.get(kind);
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_BYTES[kind]) throw new AdminError(`The ${kind === "logo" ? "logo" : "cover photo"} must be ${Math.round(MAX_BYTES[kind] / 1024)} KB or smaller.`);
  return { bytes: new Uint8Array(await file.arrayBuffer()) };
}

export async function saveVpsAction(id: string | null, form: FormData): Promise<AdminResult<{ id: string; slug: string }>> {
  return runAdminAction(
    "vps:manage",
    async (actor) => {
      const saved = await saveVps(actor, id, formToInput(form), {
        logo: await readImage(form, "logo"),
        cover: await readImage(form, "cover"),
        removeLogo: form.get("removeLogo") === "on",
        removeCover: form.get("removeCover") === "on",
      });
      refresh();
      return { id: saved.id, slug: saved.slug };
    },
    { rateLimit: RATE },
  );
}

export async function vpsStatusAction(id: string, op: VpsStatusOp): Promise<AdminResult> {
  if (!["publish", "unpublish", "archive", "restore"].includes(op)) return { ok: false, error: "Unknown action." };
  return runAdminAction(
    "vps:manage",
    async (actor) => {
      await changeVpsStatus(actor, id, op);
      refresh();
      return {};
    },
    { rateLimit: RATE },
  );
}

export async function moveVpsAction(id: string, direction: "up" | "down"): Promise<AdminResult> {
  if (direction !== "up" && direction !== "down") return { ok: false, error: "Unknown action." };
  return runAdminAction(
    "vps:manage",
    async (actor) => {
      await moveVps(actor, id, direction);
      refresh();
      return {};
    },
    { rateLimit: RATE },
  );
}

export async function deleteVpsAction(id: string): Promise<AdminResult> {
  return runAdminAction(
    "vps:manage",
    async (actor) => {
      await deleteVps(actor, id);
      refresh();
      return {};
    },
    { rateLimit: RATE },
  );
}
