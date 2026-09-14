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
