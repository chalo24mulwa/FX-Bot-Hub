import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    // The calendar page normally triggers a background sync from the live
    // Finance Calendar API; a test run must never call an external service
    // or change calendar rows under the specs' feet.
    // PARTNERSHIP_ALLOW_MANUAL_PAYMENT_COMMISSIONS: the e2e build runs in
    // production mode with the `manual` payment provider, whose orders never
    // earn Partner commission on the live site. Tests only.
    // STORAGE_*: blank on purpose, so uploads use the built-in database storage exactly as production does
    // today (no bucket). That makes real file uploads testable in CI, which has no MinIO. The public base
    // URL is inlined at build time, so it has to be blank for the build too (this env covers both commands).
    env: {
      ECONOMIC_CALENDAR_AUTO_SYNC: "false",
      PARTNERSHIP_ALLOW_MANUAL_PAYMENT_COMMISSIONS: "true",
      STORAGE_ACCESS_KEY_ID: "",
      STORAGE_SECRET_ACCESS_KEY: "",
      NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL: "",
    },
    timeout: 120_000,
  },
});
