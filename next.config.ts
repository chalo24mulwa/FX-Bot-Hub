import type { NextConfig } from "next";

// Baseline security headers. CSP is intentionally not set here yet —
// enabling it safely requires auditing every inline script/style source
// (including Server Actions/next/font) first; tighten this before launch
// rather than shipping a CSP that's either broken or too permissive.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Enables the minimal Dockerfile: .next/standalone bundles only the
  // dependencies each route actually needs.
  output: "standalone",

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  images: {
    // Local dev serves uploads from a MinIO/S3-compatible server on
    // localhost (docker compose), which the image optimizer's SSRF guard
    // rejects by default ("url" parameter is not allowed) — so cover photos
    // and screenshots would never render locally. Production storage is a
    // public HTTPS bucket/CDN, so this stays off there.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",

    // Product images live in seller/admin-controlled object storage
    // (S3/R2/MinIO) whose hostname varies by environment (env.STORAGE_*),
    // so this stays a wildcard rather than a fixed allowlist.
    remotePatterns: [
      { protocol: "http", hostname: "**" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
