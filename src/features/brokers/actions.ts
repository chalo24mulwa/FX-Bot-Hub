"use server";

import { revalidatePath } from "next/cache";
import { runAdminAction, type AdminResult } from "@/features/admin/core";
import { AdminError } from "@/features/admin/core";
import { MAX_LOGO_BYTES } from "@/lib/brokers/logo";
import { changeBrokerStatus, deleteBroker, moveBroker, saveBroker, type StatusOp } from "./service";

// Server Actions for /admin/brokers. Each one re-checks `broker:manage` on the server (the page that
// rendered the button is never the guard), is rate-limited per administrator, and refreshes the public
// pages so a publish/edit/reorder shows up immediately.

const RATE = { bucket: "broker-admin", limit: 120, windowSeconds: 300 };

function refresh() {
  revalidatePath("/best-brokers", "layout");
  revalidatePath("/admin/brokers", "layout");
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

/** Turns the submitted form into the raw object the shared schema validates. */
function formToInput(form: FormData) {
  return {
    name: text(form, "name"),
    tagline: text(form, "tagline"),
    officialUrl: text(form, "officialUrl"),
    affiliateUrl: text(form, "affiliateUrl"),
    sponsored: form.get("sponsored") === "on",
    featured: form.get("featured") === "on",
    features: [text(form, "features")],
    whySelected: text(form, "whySelected"),
    bestFor: [...form.getAll("bestFor").map(String), text(form, "bestForCustom")].flatMap((v) => v.split(/[\n,]+/)),
    platforms: [...form.getAll("platforms").map(String), text(form, "platformsCustom")].flatMap((v) => v.split(/[\n,]+/)),
    instruments: text(form, "instruments"),
    accountTypes: text(form, "accountTypes"),
    minDeposit: text(form, "minDeposit"),
    spreadsInfo: text(form, "spreadsInfo"),
    regulation: text(form, "regulation"),
    rating: numberOrNull(text(form, "rating")),
    ratingNote: text(form, "ratingNote"),
    infoVerifiedAt: text(form, "infoVerifiedAt").trim() || null,
    position: numberOrNull(text(form, "position")),
  };
}

export async function saveBrokerAction(id: string | null, form: FormData): Promise<AdminResult<{ id: string; slug: string }>> {
  return runAdminAction(
    "broker:manage",
    async (actor) => {
      let logo: { bytes: Uint8Array } | null = null;
      const file = form.get("logo");
      if (file instanceof File && file.size > 0) {
        if (file.size > MAX_LOGO_BYTES) throw new AdminError(`The logo must be ${Math.round(MAX_LOGO_BYTES / 1024)} KB or smaller.`);
        logo = { bytes: new Uint8Array(await file.arrayBuffer()) };
      }
      const saved = await saveBroker(actor, id, formToInput(form), { logo, removeLogo: form.get("removeLogo") === "on" });
      refresh();
      return { id: saved.id, slug: saved.slug };
    },
    { rateLimit: RATE },
  );
}

export async function brokerStatusAction(id: string, op: StatusOp): Promise<AdminResult> {
  if (!["publish", "unpublish", "archive", "restore"].includes(op)) return { ok: false, error: "Unknown action." };
  return runAdminAction(
    "broker:manage",
    async (actor) => {
      await changeBrokerStatus(actor, id, op);
      refresh();
      return {};
    },
    { rateLimit: RATE },
  );
}

export async function moveBrokerAction(id: string, direction: "up" | "down"): Promise<AdminResult> {
  if (direction !== "up" && direction !== "down") return { ok: false, error: "Unknown action." };
  return runAdminAction(
    "broker:manage",
    async (actor) => {
      await moveBroker(actor, id, direction);
      refresh();
      return {};
    },
    { rateLimit: RATE },
  );
}

export async function deleteBrokerAction(id: string): Promise<AdminResult> {
  return runAdminAction(
    "broker:manage",
    async (actor) => {
      await deleteBroker(actor, id);
      refresh();
      return {};
    },
    { rateLimit: RATE },
  );
}
