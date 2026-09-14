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
  // Public-read base URL (CDN or bucket website endpoint) for images —
  // screenshots/cover images are served directly from here, unlike EA/
  // indicator files which stay private behind getSignedDownloadUrl.
  STORAGE_PUBLIC_BASE_URL: z.string().optional(),

  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("FX Bot Market <no-reply@fxbotmarket.local>"),

  PAYMENT_PROVIDER: z.enum(["manual", "stripe", "mpesa"]).default("manual"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  MPESA_CONSUMER_KEY: z.string().optional(),
  MPESA_CONSUMER_SECRET: z.string().optional(),
  MPESA_SHORTCODE: z.string().optional(),
  MPESA_PASSKEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

// Parsed once per process. Fails fast on boot if required vars are missing,
// instead of surfacing as an obscure error deep in a request handler.
export const env: Env = envSchema.parse(process.env);
