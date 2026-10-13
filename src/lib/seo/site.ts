import type { Metadata } from "next";

/**
 * Brand + shared SEO defaults. Pure (no `@/lib/env` import) so it can be used
 * from metadata exports and unit tests alike.
 */
export const SITE_NAME = "FX Bot Hub";
export const SITE_TAGLINE = "Forex Trading Tools and Market Intelligence";
export const SITE_DESCRIPTION =
  "FX Bot Hub is a marketplace for MT4 and MT5 Expert Advisors and trading indicators, with a forex news calendar, market news, trading signals and a trader community.";

/** 1200x630 share image in /public, used wherever a page has no image of its own. */
export const DEFAULT_OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
};

interface PageSeoInput {
  /** Page title; the root layout's template appends " | FX Bot Hub". */
  title: string;
  description: string;
  /** Path of this page's canonical URL, e.g. "/calendar" (resolved against metadataBase). */
  path: string;
  /** Mark thin or private pages noindex while still letting crawlers follow their links. */
  noindex?: boolean;
}

/**
 * Metadata for a public page: title, description, a self-referencing canonical, and
 * Open Graph/Twitter tags. Next merges metadata shallowly, so a page that sets
 * `openGraph` replaces the root one entirely — this rebuilds it with the site name
 * and default image instead of silently dropping them.
 */
export function pageMetadata({ title, description, path, noindex }: PageSeoInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: `${title} | ${SITE_NAME}`,
      description,
      url: path,
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [DEFAULT_OG_IMAGE.url],
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Metadata for pages that must never appear in search results (auth, cart, invoices). */
export const PRIVATE_PAGE_ROBOTS: Metadata["robots"] = { index: false, follow: false };
