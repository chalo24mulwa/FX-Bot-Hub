import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  NEXTAUTH_URL: z.string().url().optional(),
  // Optional: when both are set, Google is added as a sign-in provider
  // alongside credentials (see src/lib/auth.ts). Leave unset to stay
  // credentials-only.
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),

  RATE_LIMIT_DISABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),

  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_REGION: z.string().default("us-east-1"),
  STORAGE_BUCKET: z.string().default("fx-bot-market"),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  // NOTE: the public-read base URL for images is NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL,
  // read directly in src/lib/storage/public-url.ts — not through this
  // object, since that file must also load in the browser and this whole
  // module (server secrets included) cannot.

  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("fx Bot Hub <no-reply@fxbotmarket.local>"),

  PAYMENT_PROVIDER: z.enum(["manual", "stripe", "mpesa"]).default("manual"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  MPESA_CONSUMER_KEY: z.string().optional(),
  MPESA_CONSUMER_SECRET: z.string().optional(),
  MPESA_SHORTCODE: z.string().optional(),
  MPESA_PASSKEY: z.string().optional(),

  // Economic calendar data pipeline. "manual" (default) needs no
  // credentials — admins enter/correct events directly at /admin/calendar.
  // "authorized" activates AuthorizedCalendarProvider (src/services/
  // calendar/providers/authorized-provider.ts), which calls a licensed
  // economic-calendar API (Trading Economics' Calendar endpoint by
  // default — see that file's doc comment) and requires the API_KEY below.
  // Never scrape Forex Factory or any other site for this data — see
  // CLAUDE.md's data-sourcing rule.
  ECONOMIC_CALENDAR_PROVIDER: z.enum(["manual", "authorized", "financecalendar"]).default("manual"),
  // Server-only. Never read this from a Client Component or expose it in
  // an API response — see src/services/calendar/providers/authorized-provider.ts.
  ECONOMIC_CALENDAR_API_KEY: z.string().optional(),
  ECONOMIC_CALENDAR_API_URL: z.string().url().default("https://api.tradingeconomics.com"),
  // How far ahead/behind "now" each calendarSync run pulls — see
  // src/services/calendar/sync-service.ts's SYNC window comment. Kept
  // narrow by default so a sync pass stays a single bounded API call, not
  // a full-history backfill.
  ECONOMIC_CALENDAR_SYNC_UPCOMING_DAYS: z.coerce.number().int().min(1).max(90).default(90),
  ECONOMIC_CALENDAR_SYNC_RECENT_DAYS: z.coerce.number().int().min(0).max(30).default(3),
  // How often the calendar is re-synced. Drives the page-view auto-sync
  // (src/services/calendar/auto-sync.ts) and the /api/cron/calendar-sync
  // endpoint: a sync runs only if the last one is at least this old. Also
  // what an external cron for the queue-based scripts SHOULD be set to, and
  // the basis of the "next sync" estimate at /admin/data-sources.
  ECONOMIC_CALENDAR_SYNC_INTERVAL_MINUTES: z.coerce.number().int().min(5).default(60),
  // Level 2 refresh: how often the calendar page's client-side auto-refresh
  // re-fetches (src/components/calendar/calendar-auto-refresh.tsx). 0
  // disables it. Read server-side and passed down as a prop — no need for
  // a NEXT_PUBLIC_ var since nothing in the browser reads process.env here.
  ECONOMIC_CALENDAR_POLL_INTERVAL_SECONDS: z.coerce.number().int().min(0).default(60),
  // Finance Calendar (https://www.financecalendar.com/api/) — the free,
  // key-less primary calendar feed (FinanceCalendarProvider). Auto-sync
  // needs no scheduler: when the calendar page is viewed and the last sync
  // is older than ECONOMIC_CALENDAR_SYNC_INTERVAL_MINUTES, one background
  // sync runs (see src/services/calendar/auto-sync.ts). Set to "false" to
  // turn that off (tests/CI do) and rely on /api/cron/calendar-sync or the
  // queue worker instead.
  ECONOMIC_CALENDAR_AUTO_SYNC: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
  FINANCE_CALENDAR_API_URL: z.string().url().default("https://www.financecalendar.com/wp-json/fc/v1"),
  // Bearer secret for GET/POST /api/cron/calendar-sync (an hPanel cron job
  // or external pinger). Unset — or shorter than 16 chars, checked in the
  // route rather than here so a weak value can never fail env parsing and
  // take the whole site down — means the endpoint doesn't exist (404); the
  // lazy auto-sync above works without it.
  CRON_SECRET: z.string().optional(),

  // Live market-data chart (homepage hero) — src/lib/market-data/. Separate
  // from the calendar/news/market-data DataSource sync architecture above;
  // this is an interactive, on-demand provider used directly by API routes,
  // not a scheduled job. "twelvedata" (default) needs the API key below;
  // there is no "manual"/no-credential option here — without a real key the
  // hero chart shows an explicit "not configured" state rather than
  // fabricating prices (see src/lib/market-data/providers/twelvedata-provider.ts).
  MARKET_DATA_PROVIDER: z.enum(["twelvedata"]).default("twelvedata"),
  // Server-only. Never read this from a Client Component, an API response,
  // or an SSE payload — see src/lib/market-data/providers/twelvedata-provider.ts.
  MARKET_DATA_API_KEY: z.string().optional(),
  MARKET_DATA_API_URL: z.string().url().default("https://api.twelvedata.com"),
  MARKET_DATA_WS_URL: z.string().url().default("wss://ws.twelvedata.com/v1/quotes/price"),
});

export type Env = z.infer<typeof envSchema>;

// Parsed once per process. Fails fast on boot if required vars are missing,
// instead of surfacing as an obscure error deep in a request handler.
export const env: Env = envSchema.parse(process.env);
