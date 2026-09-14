import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables the minimal Dockerfile: .next/standalone bundles only the
  // dependencies each route actually needs.
  output: "standalone",
};

export default nextConfig;
