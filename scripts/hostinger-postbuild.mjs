// Copies the two folders Next.js's `output: "standalone"` build doesn't
// include by default (public/ and .next/static/) into .next/standalone/
// — without this, the standalone server.js starts but serves no CSS/JS/
// images/fonts. Required after every `next build` on a standalone deploy
// target; see Next.js's own docs on `output: "standalone"`. Run via
// `npm run build:standalone` (see docs/DEPLOY_HOSTINGER.md).
import { cpSync, existsSync } from "node:fs";

function copyIfExists(src, dest) {
  if (!existsSync(src)) {
    console.warn(`[hostinger-postbuild] skip: ${src} not found`);
    return;
  }
  cpSync(src, dest, { recursive: true });
  console.log(`[hostinger-postbuild] copied ${src} -> ${dest}`);
}

copyIfExists("public", ".next/standalone/public");
copyIfExists(".next/static", ".next/standalone/.next/static");
