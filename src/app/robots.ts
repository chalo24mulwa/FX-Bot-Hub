import type { MetadataRoute } from "next";
import { resolveSiteUrl } from "@/lib/site-url";

// Same defensive base URL as the root layout's metadataBase, so robots.txt, the sitemap
// and every page's canonical always agree on one host (https://fxbothub.com).
const siteUrl = resolveSiteUrl().replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private areas and APIs. Auth pages are deliberately *not* blocked here: they
        // carry a noindex meta tag instead, which crawlers can only see if allowed in.
        disallow: ["/admin", "/seller", "/dashboard", "/api", "/cart", "/invoices"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
