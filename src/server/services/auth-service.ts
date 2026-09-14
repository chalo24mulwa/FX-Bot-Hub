import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import type { SignUpInput } from "@/lib/validations/auth";

const BCRYPT_ROUNDS = 12;

export async function registerUser(input: SignUpInput) {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  return db.user.create({
    data: { name: input.name, email: input.email, password: passwordHash },
    select: { id: true, name: true, email: true, role: true },
  });
}
