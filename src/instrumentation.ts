// Runs once when the Next.js server process starts (not during the build, not on the edge runtime).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { startBackgroundWarmers } = await import("@/lib/warmup");
  startBackgroundWarmers();
}
