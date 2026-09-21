import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { findUserByEmail, normalizeEmail } from "@/lib/auth-email";
import type { SignUpInput } from "@/lib/validations/auth";
import { enqueueEmail } from "@/jobs/send-email";
import { buildWelcomeEmail } from "@/emails/templates";

const BCRYPT_ROUNDS = 12;

export async function registerUser(input: SignUpInput) {
  const email = normalizeEmail(input.email);
  // Case-insensitive: an account under `Foo@x.com` blocks a second `foo@x.com`.
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await db.user.create({
    data: {
      name: input.name,
      email,
      password: passwordHash,
      profile: { create: { displayName: input.name } },
    },
    select: { id: true, name: true, email: true, role: true },
  });

  // Fire-and-forget: registration must not wait on (or fail because of) the
  // email queue — enqueueEmail already fails soft internally, but not
  // awaiting it here also keeps a slow/unreachable Redis off the response
  // path entirely.
  void enqueueEmail(user.email, buildWelcomeEmail(user.name ?? "there"));

  return user;
}
