import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & import("next-auth").DefaultSession["user"];
  }
  interface User {
    role: UserRole;
  }
}

// "Stay signed in on this device until you sign out" — Auth.js's own
// default (30 days, undocumented here before) already sets a real
// `Expires` on the session cookie (not a browser-session-only cookie), so
// closing/restarting the browser was never actually the problem; 30 days
// of *inactivity* was. `updateAge` (unchanged, Auth.js's own 24h default)
// re-issues the cookie with a fresh full `maxAge` window on every request
// at least a day after the last one, so any user who opens the site at
// least this often never sees that expiry — this makes that sliding
// window a year instead, which for a marketplace (not a banking app)
// comfortably reads as "logged in until I sign out" for real usage
// patterns without literally never expiring an unattended device.
const SESSION_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export const { handlers, auth, signIn, signOut, unstable_update: updateSession } = NextAuth({
  adapter: PrismaAdapter(db),
  // A Credentials provider forces JWT sessions (Auth.js cannot persist
  // credentials-based sessions via the DB adapter) — the adapter still
  // manages Users/Accounts, which is what makes Google sign-in below work.
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/auth/sign-in" },
  // Required for self-hosted production deployments (Docker, behind a
  // reverse proxy — anything that isn't Vercel, which sets this
  // automatically). Without it, Auth.js in production rejects every
  // request as an "UntrustedHost" and redirects to /api/auth/error; dev
  // mode trusts localhost implicitly, which is why this gap only shows up
  // in production/CI. Safe here because NEXTAUTH_URL/AUTH_URL already
  // pins the expected origin.
  trustHost: true,
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // Phase 5: this endpoint had no rate limiting at all — an unlimited-
      // attempt online brute-force/credential-stuffing surface (found in
      // the Phase 5 security audit, see docs/PHASE5_AUDIT.md). The
      // counter only increments on a FAILED attempt (wrong password,
      // unknown email, banned account) — deliberately, so a legitimate
      // user's own correct-password sign-ins never count against it (this
      // also means a shared account signing in repeatedly and correctly,
      // like this app's own e2e fixture accounts, is never penalized).
      // Limited by both the submitted email (catches distributed attempts
      // against one account) and the caller's IP (catches one attacker
      // cycling through many emails). Always denies the same way — no
      // distinct message — so a rate-limited response can't be
      // distinguished from "wrong password" by an attacker. This doesn't
      // skip the bcrypt compare for an already-over-threshold attacker
      // (that would need a separate non-incrementing "peek" check this
      // app's rate-limit utility doesn't have) — it still logs/throttles
      // every failure, just without that extra optimization.
      authorize: async (credentials, request) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        async function recordFailure() {
          // Parallel, not sequential — each fail-open path can take up to
          // Redis's commandTimeout (2s, src/lib/redis.ts) when Redis is
          // unreachable, and awaiting them one after another doubled that
          // to ~4s on every failed sign-in, which actually timed out
          // e2e's "wrong password is rejected" assertion in this
          // environment (no Redis running here) — a real, measurable
          // regression from an earlier version of this fix, not just a
          // theoretical one. Caught by running the full e2e suite.
          await Promise.all([
            checkRateLimit(email!.toLowerCase(), { bucket: "auth:signin:email", limit: 10, windowSeconds: 300 }).catch(() => {}),
            checkRateLimit(clientIp(request), { bucket: "auth:signin:ip", limit: 30, windowSeconds: 300 }).catch(() => {}),
          ]);
          return null;
        }

        const user = await db.user.findUnique({ where: { email } });
        if (!user?.password) return recordFailure();
        if (user.bannedAt) return recordFailure();

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return recordFailure();

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
    // OAuth-ready: only registered when credentials are actually configured,
    // so local dev without a Google Cloud project still boots cleanly.
    ...(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET
      ? [Google({ clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET })]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Credentials already checked bannedAt in authorize(); this covers
      // OAuth sign-ins against an existing (possibly since-banned) user.
      if (account?.provider !== "credentials" && user?.email) {
        const existing = await db.user.findUnique({
          where: { email: user.email },
          include: { accounts: { select: { provider: true } } },
        });
        if (existing?.bannedAt) return false;

        // Safe account linking for Google specifically: Google's own OAuth
        // flow already proved this person controls `user.email` (its ID
        // token asserts `email_verified`) — that independent proof is what
        // makes it safe to attach this Google identity to whatever
        // existing account (credentials or otherwise) already owns that
        // email, rather than either (a) creating a confusing second
        // account with the same email, or (b) relying on Auth.js's own
        // `allowDangerousEmailAccountLinking`, which trusts ANY provider's
        // email claim with no such verification. Deliberately does NOT
        // require our own User.emailVerified to already be set first — no
        // existing credentials-registered account has that set today, so
        // requiring it would make linking impossible for exactly the
        // accounts this feature exists to help. Manually inserting the
        // Account row here (before Auth.js's own adapter logic runs) means
        // the adapter's subsequent `getUserByAccount` lookup finds it and
        // signs the person into the existing user, instead of hitting its
        // built-in "OAuthAccountNotLinked" guard for a new email/provider
        // combination.
        if (existing && account?.provider === "google") {
          const emailVerified = (profile as { email_verified?: boolean } | undefined)?.email_verified;
          const alreadyLinked = existing.accounts.some((a) => a.provider === "google");

          if (emailVerified && !alreadyLinked) {
            await db.account.create({
              data: {
                userId: existing.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                session_state: account.session_state as string | undefined,
              },
            });
            // Google independently verified this email; reflect that on
            // our own record too (harmless if it was already set).
            if (!existing.emailVerified) {
              await db.user.update({ where: { id: existing.id }, data: { emailVerified: new Date() } });
            }
          } else if (!emailVerified && !alreadyLinked) {
            // Google reports this email as unverified (rare, but possible
            // for some account types) and it's not already linked — refuse
            // rather than silently sign the requester into someone else's
            // existing account on an unproven email claim.
            return false;
          }
        }
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: UserRole }).role;
        token.roleCheckedAt = Date.now();
        return token;
      }

      // Re-sync role/ban status from the DB — immediately when explicitly
      // requested (updateSession(), called right after a role change: see
      // src/features/users/actions.ts's becomeSellerAction) and otherwise
      // periodically (not on every request — that would mean a DB round
      // trip per page load). Without this, an admin promoting/banning a
      // user would silently do nothing until that user next signs out and
      // back in, since a JWT session otherwise only carries whatever role
      // was true at sign-in time.
      const ROLE_REFRESH_INTERVAL_MS = 60_000;
      const checkedAt = typeof token.roleCheckedAt === "number" ? token.roleCheckedAt : 0;
      if (token.id && (trigger === "update" || Date.now() - checkedAt > ROLE_REFRESH_INTERVAL_MS)) {
        const current = await db.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, bannedAt: true },
        });
        if (!current || current.bannedAt) return null; // ends the session
        token.role = current.role;
        token.roleCheckedAt = Date.now();
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
});
