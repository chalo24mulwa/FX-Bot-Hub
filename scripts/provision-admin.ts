// Provisions (or safely updates) the first Super Administrator.
//
//   ADMIN_INITIAL_PASSWORD='<temporary password>' npm run admin:provision
//   ... -- --email someone@example.com --name "Name"   (defaults: admin@fxbothub.com)
//   ... -- --reset-password   set a new temporary password on an existing Super Administrator
//   ... -- --adopt            make an existing, non-admin account with this email a Super Administrator
//   ... -- --allow-remote     required when DATABASE_URL is not localhost (i.e. production)
//
// The password is read ONLY from the ADMIN_INITIAL_PASSWORD environment variable — never from a
// command-line argument (those show up in process lists and shell history), never from a file in
// the repository, and it is never printed or logged. It is stored as a bcrypt hash. The account is
// marked `mustChangePassword`, which keeps /admin closed until the password has been changed.
//
// Run it once, change the password at first sign-in, then unset the variable.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { describeDatabase, isLocalDatabase, planProvision, validateInitialPassword } from "../src/lib/admin/provision";

const BCRYPT_ROUNDS = 12;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const email = (arg("email") ?? process.env.ADMIN_EMAIL ?? "admin@fxbothub.com").trim().toLowerCase();
  const name = arg("name") ?? "FXBotHub Administrator";
  const databaseUrl = process.env.DATABASE_URL;

  console.log(`Database: ${describeDatabase(databaseUrl)}`);
  if (!isLocalDatabase(databaseUrl) && !flag("allow-remote")) {
    throw new Error("DATABASE_URL is not localhost. Re-run with --allow-remote if you really mean to change this database.");
  }

  const db = new PrismaClient();
  try {
    const existing = await db.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, role: true, password: true, createdAt: true, accounts: { select: { provider: true } } },
    });
    const plan = planProvision(
      existing ? { role: existing.role, hasPassword: existing.password !== null, createdAt: existing.createdAt, linkedProviders: existing.accounts.map((a) => a.provider) } : null,
      { adopt: flag("adopt"), resetPassword: flag("reset-password") },
    );

    if (plan.kind === "none") return void console.log(plan.message);
    if (plan.kind === "refuse") {
      console.error(plan.message);
      process.exitCode = 2;
      return;
    }

    const password = process.env.ADMIN_INITIAL_PASSWORD;
    const check = validateInitialPassword(password, email);
    if (!check.ok) throw new Error(check.error);
    const hash = await bcrypt.hash(password as string, BCRYPT_ROUNDS);
    if (plan.kind === "adopt") console.warn(`WARNING: ${plan.warning}`);

    if (plan.kind === "create") {
      const user = await db.user.create({
        data: {
          email,
          name,
          password: hash,
          role: "SUPER_ADMIN",
          emailVerified: new Date(),
          mustChangePassword: true,
          profile: { create: { displayName: name } },
        },
        select: { id: true },
      });
      await db.auditLog.create({ data: { actorId: null, action: "admin.provisioned", entityType: "User", entityId: user.id, metadata: { email, mode: "created" } } });
      console.log(`Created Super Administrator ${email}. They must change the temporary password at first sign-in.`);
    } else {
      await db.user.update({
        where: { id: existing!.id },
        data: { password: hash, role: "SUPER_ADMIN", bannedAt: null, mustChangePassword: true, emailVerified: new Date() },
      });
      await db.auditLog.create({ data: { actorId: null, action: "admin.provisioned", entityType: "User", entityId: existing!.id, metadata: { email, mode: plan.kind } } });
      console.log(`${plan.kind === "adopt" ? "Adopted" : "Reset the password of"} ${email} (Super Administrator). They must change the temporary password at first sign-in.`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
