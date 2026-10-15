import { cache } from "react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { ViewerPartnerState } from "@/lib/partnership/cta";

const DEFAULTS = { programmeOpen: true, partnerRateBps: 2000, masterRateBps: 1000 };

/**
 * Read-only programme settings for promotional copy (never the upsert in
 * core.ts — CTAs render on busy pages and must not write). Falls back to the
 * defaults if the table is missing, e.g. code deployed before its migration.
 */
export const readPromoSettings = cache(async () => {
  try {
    const row = await db.partnershipSettings.findUnique({
      where: { id: "singleton" },
      select: { programmeOpen: true, partnerRateBps: true, masterRateBps: true },
    });
    return row ?? DEFAULTS;
  } catch (err) {
    logger.warn("partnership: settings unavailable for CTA", { error: err instanceof Error ? err.message : String(err) });
    return DEFAULTS;
  }
});

/** The current viewer's real Partnership status, once per request. */
export const getViewerPartnerState = cache(async (): Promise<ViewerPartnerState> => {
  const [session, settings] = await Promise.all([auth(), readPromoSettings()]);
  if (!session?.user) return { signedIn: false, status: null, masterStatus: null, programmeOpen: settings.programmeOpen };
  try {
    const profile = await db.partnerProfile.findUnique({ where: { userId: session.user.id }, select: { status: true, masterStatus: true } });
    return { signedIn: true, status: profile?.status ?? null, masterStatus: profile?.masterStatus ?? null, programmeOpen: settings.programmeOpen };
  } catch {
    return { signedIn: true, status: null, masterStatus: null, programmeOpen: settings.programmeOpen };
  }
});
