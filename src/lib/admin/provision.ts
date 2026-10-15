// Pure rules for provisioning the first administrator (scripts/provision-admin.ts).
// Kept free of any database or process access so the decisions are unit-tested.

export type Check = { ok: true } | { ok: false; error: string };

const COMMON = new Set(["password", "password1", "password123", "123456789012", "qwertyuiop12", "administrator", "adminadmin12", "letmein12345", "fxbothub1234"]);

/**
 * The initial password is temporary (the account must change it on first sign-in),
 * but it still sits in a shell history or a secrets store for a while — so it must
 * not be guessable. Length is capped at 72 because bcrypt ignores everything past it.
 */
export function validateInitialPassword(password: string | undefined, email: string): Check {
  if (!password) return { ok: false, error: "ADMIN_INITIAL_PASSWORD is not set." };
  if (password.length < 12) return { ok: false, error: "The initial password must be at least 12 characters." };
  if (password.length > 72) return { ok: false, error: "The initial password must be 72 characters or fewer (bcrypt ignores the rest)." };
  if (new Set(password).size < 5) return { ok: false, error: "The initial password is too repetitive." };
  const lower = password.toLowerCase();
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (local.length >= 4 && lower.includes(local)) return { ok: false, error: "The initial password must not contain the account's email name." };
  if (COMMON.has(lower)) return { ok: false, error: "That password is too common." };
  return { ok: true };
}

export interface ExistingAccount {
  role: string;
  hasPassword: boolean;
  createdAt: Date;
  linkedProviders: string[];
}

export type ProvisionPlan =
  | { kind: "create" }
  | { kind: "none"; message: string }
  | { kind: "reset_password" }
  | { kind: "adopt"; warning: string }
  | { kind: "refuse"; message: string };

/**
 * What to do for the administrator email. Public registration was open before this
 * address was reserved, so an account that already exists under it may belong to a
 * stranger — never promote one silently. Adopting it is an explicit flag, and it also
 * replaces the password; the warning says what that can't undo.
 */
export function planProvision(existing: ExistingAccount | null, flags: { adopt: boolean; resetPassword: boolean }): ProvisionPlan {
  if (!existing) return { kind: "create" };
  if (existing.role === "SUPER_ADMIN") {
    return flags.resetPassword
      ? { kind: "reset_password" }
      : { kind: "none", message: "This account is already a Super Administrator. Nothing was changed (its password was left alone). Use --reset-password to set a new temporary password." };
  }
  if (!flags.adopt) {
    const methods = [existing.hasPassword ? "password" : null, ...existing.linkedProviders].filter(Boolean).join(", ") || "none";
    return {
      kind: "refuse",
      message:
        `An account with this email already exists (role ${existing.role}, created ${existing.createdAt.toISOString().slice(0, 10)}, sign-in: ${methods}). ` +
        "Public sign-up was open before this address was reserved, so it may not be yours. Nothing was changed. " +
        "If it is yours and you want it made a Super Administrator, re-run with --adopt.",
    };
  }
  return {
    kind: "adopt",
    warning:
      "Adopting an existing account: its role becomes SUPER_ADMIN and its password is replaced. Any browser that is already signed in to it " +
      "stays signed in (and would gain the new role) until its session expires — if you have any doubt who has used this account, rotate AUTH_SECRET afterwards to sign everyone out.",
  };
}

export function isLocalDatabase(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
}

/** Host and database name only — never the credentials. */
export function describeDatabase(url: string | undefined): string {
  if (!url) return "(DATABASE_URL not set)";
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? `:${u.port}` : ""}${u.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}
