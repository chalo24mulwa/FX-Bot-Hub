# FX Bot Market

A Forex Expert Advisor / indicator marketplace with an integrated economic
calendar — structurally inspired by MQL5 Market (catalog), Forex Factory Calendar
(filtering), and TradingView's Economic Calendar (data presentation).

See [CLAUDE.md](./CLAUDE.md) for the architecture map and the ground rule that
governs every future phase: **extend this foundation, don't rebuild it.**

## Stack

Next.js (App Router) + TypeScript · PostgreSQL + Prisma · Redis + BullMQ ·
Auth.js v5 (credentials + optional Google OAuth) · Tailwind CSS · shadcn/ui-style
primitives · Zod · S3-compatible storage · pluggable payment/email/search
providers · centralized RBAC (`USER`/`SELLER`/`AUTHOR`/`MODERATOR`/`ADMIN`/
`SUPER_ADMIN`). Full rationale in CLAUDE.md.

## Local development

1. Copy the env file and fill in secrets:

   ```bash
   cp .env.example .env
   ```

2. Start Postgres, Redis, and MinIO (S3-compatible storage):

   ```bash
   docker compose up -d db redis minio
   ```

3. Install dependencies, apply migrations, seed demo data:

   ```bash
   npm install
   npm run db:migrate
   npm run db:seed
   ```

4. Run the app:

   ```bash
   npm run dev
   ```

   Visit [http://localhost:3000](http://localhost:3000). Seeded logins (password
   `password123` for all): `vendor@fxbotmarket.local` (SELLER),
   `buyer@fxbotmarket.local` (USER), `moderator@fxbotmarket.local` (ADMIN),
   `admin@fxbotmarket.local` (SUPER_ADMIN). Try the seller flow at `/seller`,
   admin moderation at `/admin/products`.

## Scripts

| Command                | Purpose                                    |
| ----------------------- | ------------------------------------------- |
| `npm run dev`           | Start the Next.js dev server                |
| `npm run build`         | Production build                            |
| `npm run typecheck`     | `tsc --noEmit`                              |
| `npm run lint`          | ESLint                                      |
| `npm run test`          | Unit tests (Vitest)                         |
| `npm run test:e2e`      | End-to-end tests (Playwright)                |
| `npm run db:migrate`    | Create/apply a dev migration                |
| `npm run db:seed`       | Seed demo vendor, product, calendar event   |
| `npm run db:studio`     | Open Prisma Studio                          |
| `npm run worker:email`  | Run the BullMQ email worker                 |

## Docker

`docker compose up` builds and runs the full stack (Postgres, Redis, MinIO, and
the app itself via the multi-stage `Dockerfile`) for a production-like environment.

## Deployment

The Dockerfile produces a minimal standalone image (`output: "standalone"` in
`next.config.ts`) suitable for any container platform. `.github/workflows/ci.yml`
runs lint, typecheck, unit tests, e2e tests, and a production build on every push
and pull request.
